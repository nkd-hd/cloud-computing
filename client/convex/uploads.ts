/**
 * ============================================================================
 * CONVEX MUTATIONS & QUERIES - Database Operations
 * ============================================================================
 * 
 * CONCEPT: Mutations vs Queries
 * - MUTATION: Changes data (INSERT, UPDATE, DELETE)
 * - QUERY: Reads data (SELECT)
 * 
 * These functions run on Convex's servers, providing:
 * - Automatic persistence
 * - Real-time subscriptions
 * - ACID transactions
 * 
 * ============================================================================
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * ============================================================================
 * UPLOAD LOG OPERATIONS
 * ============================================================================
 */

/**
 * logUpload - Records a file upload in the database
 * 
 * CONCEPT: Write-Ahead Logging
 * We log the upload BEFORE (or during) processing.
 * This ensures we have a record even if the server crashes.
 * 
 * @param filename - Name of the uploaded file
 * @param fileSize - Size in bytes
 * @param content - Optional content preview
 * @param requestId - RPC request identifier for correlation
 */
export const logUpload = mutation({
    args: {
        filename: v.string(),
        fileSize: v.number(),
        contentPreview: v.optional(v.string()),
        requestId: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const uploadId = await ctx.db.insert("uploadLog", {
            filename: args.filename,
            fileSize: args.fileSize,
            contentPreview: args.contentPreview?.substring(0, 100), // Limit preview
            requestId: args.requestId,
            uploadedAt: Date.now(),
            status: args.status || "pending",
        });

        return uploadId;
    },
});

/**
 * updateUploadStatus - Updates the status of an upload
 * 
 * CONCEPT: State Machine
 * Uploads transition through states: pending → processing → completed/failed
 * 
 * @param uploadId - The ID of the upload to update
 * @param status - New status
 * @param errorMessage - Optional error message if failed
 */
export const updateUploadStatus = mutation({
    args: {
        uploadId: v.id("uploadLog"),
        status: v.string(),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.uploadId, {
            status: args.status,
            errorMessage: args.errorMessage,
        });
    },
});

/**
 * listUploads - Retrieves all uploads, newest first
 * 
 * CONCEPT: Real-time Subscriptions
 * When you subscribe to this query in the frontend,
 * Convex automatically pushes updates when data changes.
 * No polling required!
 */
export const listUploads = query({
    args: {},
    handler: async (ctx) => {
        const uploads = await ctx.db
            .query("uploadLog")
            .order("desc") // Newest first
            .take(50); // Limit for performance

        return uploads;
    },
});

/**
 * getUploadsByStatus - Filter uploads by status
 * 
 * CONCEPT: Indexed Queries
 * We defined an index on 'status' in schema.ts.
 * This makes filtering by status very efficient (O(log n) instead of O(n)).
 */
export const getUploadsByStatus = query({
    args: {
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const uploads = await ctx.db
            .query("uploadLog")
            .withIndex("by_status", (q) => q.eq("status", args.status))
            .take(50);

        return uploads;
    },
});

/**
 * deleteUpload - Removes an upload record
 */
export const deleteUpload = mutation({
    args: {
        uploadId: v.id("uploadLog"),
    },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.uploadId);
    },
});

/**
 * ============================================================================
 * JOB LOG OPERATIONS (For Queue Visualization)
 * ============================================================================
 */

/**
 * logJob - Records an RPC job in the database
 * 
 * This creates a permanent record of every RPC call.
 * Useful for:
 * - Debugging
 * - Performance analysis
 * - Demonstrating the queue concept
 */
export const logJob = mutation({
    args: {
        method: v.string(),
        receivedAt: v.number(),
        queuePosition: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const jobId = await ctx.db.insert("jobLog", {
            method: args.method,
            receivedAt: args.receivedAt,
            queuePosition: args.queuePosition,
            status: "queued",
        });

        return jobId;
    },
});

/**
 * completeJob - Marks a job as completed
 */
export const completeJob = mutation({
    args: {
        jobId: v.id("jobLog"),
        status: v.string(),
        processingTimeMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            status: args.status,
            processedAt: Date.now(),
            processingTimeMs: args.processingTimeMs,
        });
    },
});

/**
 * getJobStats - Get statistics about job processing
 * 
 * CONCEPT: Aggregation Queries
 * This provides insights into system performance.
 */
export const getJobStats = query({
    args: {},
    handler: async (ctx) => {
        const allJobs = await ctx.db.query("jobLog").collect();

        const stats = {
            total: allJobs.length,
            completed: allJobs.filter(j => j.status === "completed").length,
            failed: allJobs.filter(j => j.status === "failed").length,
            queued: allJobs.filter(j => j.status === "queued").length,
            avgProcessingTime: 0,
        };

        const completedJobs = allJobs.filter(j => j.processingTimeMs);
        if (completedJobs.length > 0) {
            stats.avgProcessingTime = completedJobs.reduce(
                (sum, j) => sum + (j.processingTimeMs || 0), 0
            ) / completedJobs.length;
        }

        return stats;
    },
});

/**
 * getRecentJobs - Get most recent jobs
 */
export const getRecentJobs = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const jobs = await ctx.db
            .query("jobLog")
            .order("desc")
            .take(args.limit || 20);

        return jobs;
    },
});
