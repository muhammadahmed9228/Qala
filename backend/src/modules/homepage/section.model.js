import mongoose, { Schema } from "mongoose";

const sectionSchema = new Schema({
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    criteria: { 
        type: String, 
        enum: ["newest", "bestselling", "featured", "collection"], 
        required: true 
    },
    collectionRef: { type: Schema.Types.ObjectId, ref: "Collection", default: null }, // Only used if criteria is 'collection'
    displayOrder: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true }
}, { timestamps: true });

sectionSchema.index({ enabled: 1, displayOrder: 1, createdAt: -1 });

export const HomeSection = mongoose.model("HomeSection", sectionSchema);
