/*
 * edgeDetection.js - ULTRA-FAST Edge Detection
 * OPTIMIZED FOR SPEED AND LOW PROCESSING
 * 
 * Teaching concept: Instead of checking every pixel against every other pixel
 * (which is very slow), we use a "spatial grid" to only check nearby pixels.
 * This is like organizing a library - instead of searching every book,
 * you go to the right section first.
 */

/**
 * FAST VERSION: Extract edges and return them for efficient drawing
 */
function extractEdgesFromMaskData(maskData) {
    if (!maskData || !maskData.pixels || maskData.width === 0 || maskData.height === 0) {
        return null;
    }
    
    // Find edge pixels using the same simple method (this part was fast)
    const edgePixels = findEdgePixelsSimple(maskData.pixels, maskData.width, maskData.height);
    
    // Return them ready for fast drawing
    return edgePixels.length > 0 ? [edgePixels] : null;
}

/**
 * LEGACY WRAPPER: Maintain compatibility
 */
function extractEdgesFromMask(mask) {
    if (!mask || mask.width === 0 || mask.height === 0) {
        return null;
    }
    
    mask.loadPixels();
    const maskData = {
        mask: mask,
        pixels: mask.pixels,
        width: mask.width,
        height: mask.height
    };
    
    return extractEdgesFromMaskData(maskData);
}

/**
 * OPTIMIZED: Find edge pixels with better sampling for performance
 */
function findEdgePixelsSimple(pixels, width, height) {
    const edgePixels = [];
    
    // More aggressive sampling for better performance
    const step = 1; // Skip more pixels for faster processing
    
    for (let y = step; y < height - step; y += step) {
        for (let x = step; x < width - step; x += step) {
            
            if (isEdgePixel(pixels, x, y, width)) {
                edgePixels.push({x: x, y: y});
            }
        }
    }
    
    // Limit total edge pixels to prevent lag accumulation
    if (edgePixels.length > 800) {
        // Keep only every nth pixel to maintain performance
        const keepEvery = Math.ceil(edgePixels.length / 800);
        return edgePixels.filter((_, index) => index % keepEvery === 0);
    }
    
    return edgePixels;
}

/**
 * SAME AS BEFORE: Check if a pixel is on an edge (this was already fast)
 */
function isEdgePixel(pixels, x, y, width) {
    const currentIdx = (y * width + x) * 4;
    const currentAlpha = pixels[currentIdx + 3];
    
    const neighbors = [
        {x: x, y: y - 1}, {x: x, y: y + 1},
        {x: x - 1, y: y}, {x: x + 1, y: y}
    ];
    
    for (let neighbor of neighbors) {
        const neighborIdx = (neighbor.y * width + neighbor.x) * 4;
        const neighborAlpha = pixels[neighborIdx + 3];
        
        const difference = Math.abs(currentAlpha - neighborAlpha);
        if (difference > 128) {
            return true;
        }
    }
    
    return false;
}

/**
 * ULTRA-FAST DRAWING: Use spatial grid for massive speed improvement
 * 
 * Teaching concept: Instead of checking every pixel against every other pixel,
 * we organize pixels into a grid. Each pixel only checks its immediate neighbors.
 * This is like organizing books in a library by subject - you don't search
 * the whole library, just the relevant section.
 */
function drawEdges(edgePixelArrays, edgeColor, thickness = 2) {
    if (!edgePixelArrays || edgePixelArrays.length === 0) return;
    
    stroke(edgeColor);
    strokeWeight(thickness);
    
    for (let edgePixels of edgePixelArrays) {
        if (!edgePixels || edgePixels.length < 2) continue;
        
        // Use the fast spatial grid approach
        drawWithSpatialGrid(edgePixels);
    }
}

/**
 * ULTRA-FAST DRAWING: Optimized spatial grid with reduced calculations
 * 
 * Performance optimizations:
 * 1. Larger grid size = fewer calculations
 * 2. Reduced max distance = fewer line draws
 * 3. Early exits to skip expensive operations
 */
function drawWithSpatialGrid(edgePixels) {
    // Early exit for small pixel sets
    // if (edgePixels.length < 5) {
    //     // For very small sets, just draw simple connections
    //     for (let i = 0; i < edgePixels.length - 1; i++) {
    //         const p1 = edgePixels[i];
    //         const p2 = edgePixels[i + 1];
    //         const dx = p1.x - p2.x;
    //         const dy = p1.y - p2.y;
    //         if (dx * dx + dy * dy <= 64) { // Distance <= 8 pixels
    //             line(p1.x, p1.y, p2.x, p2.y);
    //         }
    //     }
    //     return;
    // }
    
    const gridSize = 10; // Larger grid = fewer calculations
    const maxDistance = 500; // Shorter distance = fewer connections
    const maxDistanceSquared = maxDistance * maxDistance;
    
    // Step 1: Organize pixels into grid squares (optimized)
    const grid = new Map(); // Map is faster than object for this use case
    
    for (let pixel of edgePixels) {
        const gridX = Math.floor(pixel.x / gridSize);
        const gridY = Math.floor(pixel.y / gridSize);
        const gridKey = (gridX << 16) | gridY; // Bit shifting for faster key generation
        
        if (!grid.has(gridKey)) {
            grid.set(gridKey, []);
        }
        grid.get(gridKey).push(pixel);
    }
    
    // Step 2: Connect pixels with optimized neighbor checking
    for (let pixel of edgePixels) {
        const gridX = Math.floor(pixel.x / gridSize);
        const gridY = Math.floor(pixel.y / gridSize);
        
        // Only check right and down neighbors to avoid duplicate connections
        for (let dx = 0; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy <= 0) continue; // Skip already processed areas
                
                const checkKey = ((gridX + dx) << 16) | (gridY + dy);
                const nearbyPixels = grid.get(checkKey);
                
                if (nearbyPixels) {
                    connectToNearbyPixelsOptimized(pixel, nearbyPixels, maxDistanceSquared);
                }
            }
        }
    }
}

/**
 * OPTIMIZED CONNECTION: Faster pixel connection with early exits
 */
function connectToNearbyPixelsOptimized(pixel, nearbyPixels, maxDistanceSquared) {
    for (let otherPixel of nearbyPixels) {
        if (pixel === otherPixel) continue;
        
        // Fast distance check without sqrt
        const dx = pixel.x - otherPixel.x;
        const dy = pixel.y - otherPixel.y;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared <= maxDistanceSquared) {
            line(pixel.x, pixel.y, otherPixel.x, otherPixel.y);
        }
    }
}

// Keep these functions for compatibility
function smoothContours(contours) { return contours; }
function filterContours(contours) { return contours; }
function analyzeContours(contours) {
    if (!contours || contours.length === 0) {
        return {totalContours: 0, totalPoints: 0, averageLength: 0};
    }
    const totalPoints = contours.reduce((sum, contour) => sum + (contour.length || 0), 0);
    return {
        totalContours: contours.length,
        totalPoints: totalPoints,
        averageLength: Math.round(totalPoints / contours.length),
        longestContour: Math.max(...contours.map(c => c.length || 0))
    };
}