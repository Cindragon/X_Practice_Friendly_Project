import mongoose, { type InferSchemaType, type Model } from "mongoose";

/**
 * Draft — work-in-progress posts saved when the user dismisses the composer.
 * Same content shape as Post, but never published.
 */
const DraftSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    content: { type: String, default: "", maxlength: 10_000 },
  },
  { timestamps: true }
);

DraftSchema.index({ userId: 1, updatedAt: -1 });

export type DraftDoc = InferSchemaType<typeof DraftSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Draft: Model<DraftDoc> =
  (mongoose.models.Draft as Model<DraftDoc>) ||
  mongoose.model<DraftDoc>("Draft", DraftSchema);
