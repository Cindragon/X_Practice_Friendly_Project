import mongoose, { type InferSchemaType, type Model } from "mongoose";

/**
 * Post — both top-level posts and recursive comments live here.
 *
 *   - Top-level post  : parentId === null, repostOfId === null
 *   - Comment / reply : parentId !== null  (points to the parent Post _id)
 *   - Repost          : repostOfId !== null, content === "" (no quote support)
 *
 * authorId references a Postgres User.id (cuid). No DB-level FK — joins are
 * done in the application layer (see future src/lib/feed.ts).
 */
const PostSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, index: true },
    content: { type: String, default: "", maxlength: 10_000 },

    // Recursive comments
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    // Reposts (no quote support, per spec)
    repostOfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    // Parsed at write time so feeds don't need to re-parse on every read.
    mentions: { type: [String], default: [] }, // referenced userIDs
    hashtags: { type: [String], default: [] },

    // Soft delete — keeps reposts/replies intact when an author deletes.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Useful compound indexes for the two main feeds.
PostSchema.index({ createdAt: -1 });
PostSchema.index({ authorId: 1, createdAt: -1 });

export type PostDoc = InferSchemaType<typeof PostSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Post: Model<PostDoc> =
  (mongoose.models.Post as Model<PostDoc>) ||
  mongoose.model<PostDoc>("Post", PostSchema);
