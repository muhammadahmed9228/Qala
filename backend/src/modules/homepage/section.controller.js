import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { HomeSection } from "./section.model.js";
import { Product } from "../products/product.model.js";
import { getPagination } from "../../utils/pagination.js";
import { pickAllowedFields } from "../../utils/pickAllowedFields.js";

export const getSections = asyncHandler(async (req, res) => {
    const { sort = "order_asc" } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const isAdmin = req.user && req.user.role === "admin";
    const filter = isAdmin ? {} : { enabled: true };

    let sortOptions = { displayOrder: 1, createdAt: -1 };
    if (sort === "order_desc") sortOptions = { displayOrder: -1, createdAt: -1 };
    if (sort === "newest") sortOptions = { createdAt: -1 };
    if (sort === "oldest") sortOptions = { createdAt: 1 };
    if (sort === "status_enabled") sortOptions = { enabled: -1, displayOrder: 1 };
    if (sort === "status_disabled") sortOptions = { enabled: 1, displayOrder: 1 };

    const sections = await HomeSection.find(filter)
        .populate("collectionRef", "name slug")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
        
    const total = await HomeSection.countDocuments(filter);

    return res.status(200).json(new ApiResponse(200, {
        sections, 
        total,
        page,
        pages: Math.ceil(total / limit)
    }, "Sections fetched"));
});

// Public homepage data loader. Dynamic sections previously caused the client
// to make one products request per section. The facet pipeline keeps that
// work in one database round trip while preserving each section's own
// criteria, ordering, and twelve-item carousel limit.
export const getSectionsWithProducts = asyncHandler(async (req, res) => {
    const sections = await HomeSection.find({ enabled: true })
        .populate("collectionRef", "name slug")
        .sort({ displayOrder: 1, createdAt: -1 })
        .limit(20)
        .lean();

    if (sections.length === 0) {
        return res.status(200).json(new ApiResponse(200, { sections: [] }, "Sections fetched"));
    }

    const facet = {};
    sections.forEach((section, index) => {
        const match = { published: true, isDeleted: { $ne: true } };
        let sort = { createdAt: -1 };
        const collectionId = section.collectionRef?._id || section.collectionRef;

        if (section.criteria === "featured") {
            match.isFeatured = true;
        } else if (section.criteria === "bestselling") {
            sort = { soldCount: -1, createdAt: -1 };
        } else if (section.criteria === "collection" && collectionId) {
            match.collectionRef = collectionId;
        }

        facet[`section_${index}`] = [
            { $match: match },
            { $sort: sort },
            { $limit: 12 },
            {
                $lookup: {
                    from: "collections",
                    localField: "collectionRef",
                    foreignField: "_id",
                    as: "collectionRef"
                }
            },
            { $unwind: { path: "$collectionRef", preserveNullAndEmptyArrays: true } }
        ];
    });

    const [productsBySection] = await Product.aggregate([{ $facet: facet }]);
    const populatedSections = sections.map((section, index) => ({
        ...section,
        products: productsBySection[`section_${index}`] || []
    }));

    return res.status(200).json(new ApiResponse(200, { sections: populatedSections }, "Sections fetched"));
});


const normalizeHomeSectionPayload = (payload = {}) => {
    const nextPayload = pickAllowedFields(payload, [
        "title",
        "subtitle",
        "criteria",
        "collectionRef",
        "displayOrder",
        "enabled"
    ]);

    if (nextPayload.criteria !== undefined && (nextPayload.criteria !== "collection" || !nextPayload.collectionRef || String(nextPayload.collectionRef).trim() === "")) {
        nextPayload.collectionRef = null;
    }

    return nextPayload;
};

export const createSection = asyncHandler(async (req, res) => {
    const section = await HomeSection.create(normalizeHomeSectionPayload(req.body));
    return res.status(201).json(new ApiResponse(201, section, "Section created"));
});

export const updateSection = asyncHandler(async (req, res) => {
    const section = await HomeSection.findByIdAndUpdate(
        req.params.id,
        { $set: normalizeHomeSectionPayload(req.body) },
        { new: true, runValidators: true }
    );
    if (!section) throw new ApiError(404, "Section not found");
    return res.status(200).json(new ApiResponse(200, section, "Section updated"));
});

export const deleteSection = asyncHandler(async (req, res) => {
    await HomeSection.findByIdAndDelete(req.params.id);
    return res.status(200).json(new ApiResponse(200, {}, "Section deleted"));
});
