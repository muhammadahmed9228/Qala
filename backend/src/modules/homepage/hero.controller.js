import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { HeroSlide } from "./hero.model.js";
import { getPagination } from "../../utils/pagination.js";
import { deleteImageKitFile } from "../../services/imagekit.service.js";
import { pickAllowedFields } from "../../utils/pickAllowedFields.js";

export const createHeroSlide = asyncHandler(async (req, res) => {
    const { image, heading, subtitle, buttonText, buttonUrl, enabled, displayOrder } = req.body;

    if (!image?.url || !image?.fileId || !heading) {
        throw new ApiError(400, "Image and heading are required");
    }

    const slide = await HeroSlide.create({
        image,
        heading,
        subtitle,
        buttonText,
        buttonUrl,
        enabled,
        displayOrder,
    });

    return res.status(201).json(new ApiResponse(201, slide, "Hero slide created successfully"));
});

export const getHeroSlides = asyncHandler(async (req, res) => {
    const { sort = "order_asc" } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const isAdmin = req.user && req.user.role === "admin";
    
    // Public users only see enabled slides; Admins see all slides to manage them
    const filter = isAdmin ? {} : { enabled: true };

    // Advanced Sorting Logic
    let sortOptions = { displayOrder: 1, createdAt: -1 }; // Default
    if (sort === "order_desc") sortOptions = { displayOrder: -1, createdAt: -1 };
    if (sort === "newest") sortOptions = { createdAt: -1 };
    if (sort === "oldest") sortOptions = { createdAt: 1 };
    if (sort === "status_enabled") sortOptions = { enabled: -1, displayOrder: 1 }; // Booleans: -1 brings True to top
    if (sort === "status_disabled") sortOptions = { enabled: 1, displayOrder: 1 }; // Booleans: 1 brings False to top
    
   const slides = await HeroSlide.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
        
    const total = await HeroSlide.countDocuments(filter);

    return res.status(200).json(new ApiResponse(200, {
        slides, 
        total,
        page,
        pages: Math.ceil(total / limit)
    }, "Hero slides fetched successfully"));
});

export const updateHeroSlide = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = pickAllowedFields(req.body, [
        "image",
        "heading",
        "subtitle",
        "buttonText",
        "buttonUrl",
        "enabled",
        "displayOrder"
    ]);
    
    const slide = await HeroSlide.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!slide) throw new ApiError(404, "Hero slide not found");

    return res.status(200).json(new ApiResponse(200, slide, "Hero slide updated successfully"));
});

export const deleteHeroSlide = asyncHandler(async (req, res) => {
    const slide = await HeroSlide.findById(req.params.id);
    
    if (!slide) throw new ApiError(404, "Hero slide not found");

    try {
        // Clean up the remote asset before deleting its database reference. If
        // ImageKit is unavailable, the slide remains retryable and consistent.
        await deleteImageKitFile(slide.image?.fileId);
    } catch (error) {
        console.error("Hero slide image cleanup failed:", error);
        throw new ApiError(502, "Hero slide image cleanup failed. Please try again.");
    }

    await HeroSlide.findByIdAndDelete(slide._id);

    return res.status(200).json(new ApiResponse(200, { fileId: slide.image.fileId }, "Hero slide deleted successfully"));
});
