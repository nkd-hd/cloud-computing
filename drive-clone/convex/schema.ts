/**
 * ============================================================================
 * CONVEX SCHEMA - Database Structure Definition
 * ============================================================================
 * 
 * CONCEPT: Persistent Storage vs In-Memory Queue
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    STORAGE COMPARISON                                   │
 * ├─────────────────────┬───────────────────┬───────────────────────────────┤
 * │                     │  In-Memory Queue  │  Convex Database              │
 * ├─────────────────────┼───────────────────┼───────────────────────────────┤
 * │ Location            │  RAM (server.js)  │  Disk (Cloud)                 │
 * │ Speed               │  Microseconds     │  Milliseconds                 │
 * │ Durability          │  Lost on crash    │  Survives restart             │
 * │ Capacity            │  Limited by RAM   │  Virtually unlimited          │
 * │ Use Case            │  Hot processing   │  Permanent records            │
 * └─────────────────────┴───────────────────┴───────────────────────────────┘
 * 
 * WHY BOTH?
 * - Queue: Fast, for active processing
 * - Database: Durable, for audit/history
 * 
 * This is called a "Write-Ahead Log" pattern in distributed systems.
 * 
 * ============================================================================
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    /**
     * uploadLog - Persistent record of all file uploads
     * 
     * This table stores every upload that passes through the system.
     * Even if the RPC server crashes, this data survives.
     * 
     * CONCEPT: Audit Trail
     * In production systems, we need to track:
     * - WHAT happened (filename, action)
     * - WHEN it happened (timestamp)
     * - WHO did it (userId if applicable)
     * - OUTCOME (status)
     */
    uploadLog: defineTable({
        // File information
        filename: v.string(),
        fileSize: v.number(),
        contentPreview: v.optional(v.string()), // First 100 chars of content

        // Metadata
        uploadedAt: v.number(),      // Unix timestamp
        requestId: v.optional(v.string()), // Links to RPC request

        // Status tracking
        status: v.string(),          // "pending" | "processing" | "completed" | "failed"

        // Optional error info
        errorMessage: v.optional(v.string()),
    })
        // Index for efficient queries
        .index("by_status", ["status"])
        .index("by_uploadedAt", ["uploadedAt"]),

    /**
     * jobLog - Server activity log (for demonstration)
     * 
     * This logs all RPC calls, not just uploads.
     * Useful for debugging and demonstrating the queue concept.
     */
    jobLog: defineTable({
        method: v.string(),          // RPC method name
        receivedAt: v.number(),      // When server received the request
        processedAt: v.optional(v.number()), // When processing completed
        queuePosition: v.optional(v.number()), // Position in queue when received
        processingTimeMs: v.optional(v.number()), // How long it took
        status: v.string(),          // "queued" | "processing" | "completed" | "failed"
    })
        .index("by_method", ["method"])
        .index("by_status", ["status"]),
});
