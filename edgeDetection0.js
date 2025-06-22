/*
 * edgeDetection.js - Advanced Edge Detection for Body Outlines
 * PERFORMANCE OPTIMIZED VERSION
 * 
 * This module implements sophisticated edge detection techniques to extract
 * clean, drawable outlines from body segmentation masks. Think of this as
 * converting a "filled silhouette" into a "pencil outline."
 * 
 * CRITICAL PERFORMANCE OPTIMIZATION:
 * All functions now work with pre-loaded pixel arrays instead of calling
 * loadPixels() repeatedly. This eliminates expensive GPU-CPU memory transfers
 * and dramatically improves frame rate performance.
 * 
 * Key Computer Vision Concepts:
 * - Edge detection finds boundaries between different regions
 * - We use gradient-based methods to find rapid changes in pixel values
 * - Contour following creates connected lines from scattered edge points
 * - Smoothing reduces noise while preserving important shape features
 * 
 * The process flows like this:
 * Pre-loaded Pixel Data → Edge Detection → Contour Extraction → Smoothing → Drawable Path
 */

/**
 * OPTIMIZED: Extract edges from pre-loaded mask data instead of mask object
 * 
 * This is the new entry point that accepts a maskData object containing
 * pre-loaded pixels instead of a p5.Image that would require loading pixels again.
 * 
 * Think of this like receiving a pre-processed dataset instead of raw data
 * that you'd have to process yourself - much more efficient.
 * 
 * @param {Object} maskData - Object containing {mask, pixels, width, height}
 * @returns {Array} Array of edge paths, each containing connected points
 */
function extractEdgesFromMaskData(maskData) {
    if (!maskData || !maskData.pixels || maskData.width === 0 || maskData.height === 0) {
        return null;
    }
    
    // Optimized edge detection pipeline - no console logging for performance
    const edgeMap = detectEdgePixelsFromArray(maskData.pixels, maskData.width, maskData.height);
    const contours = extractContours(edgeMap, maskData.width, maskData.height);
    const smoothedContours = smoothContours(contours);
    const filteredContours = filterContours(smoothedContours);
    // filteredContours = removestraightLineArtifacts(filteredContours);

    return filteredContours;
}

/**
 * LEGACY WRAPPER: Extract edges from a mask object (for backward compatibility)
 * 
 * This function maintains compatibility with any code that still passes p5.Image masks.
 * It loads the pixels once and then delegates to the optimized function.
 * 
 * However, for best performance, code should use extractEdgesFromMaskData() directly.
 */
function extractEdgesFromMask(mask) {
    if (!mask || mask.width === 0 || mask.height === 0) {
        return null;
    }
    
    // Load pixels once and create maskData object
    mask.loadPixels();
    const maskData = {
        mask: mask,
        pixels: mask.pixels,
        width: mask.width,
        height: mask.height
    };
    
    // Delegate to the optimized function
    return extractEdgesFromMaskData(maskData);
}

/**
 * OPTIMIZED: Detect edge pixels using pre-loaded pixel array
 * 
 * This is the core optimization. Instead of calling mask.loadPixels() and then
 * accessing mask.pixels repeatedly, we work directly with the pixel array that
 * was loaded once upstream.
 * 
 * Performance benefit: Eliminates redundant pixel loading operations that were
 * happening every frame. This is like having all your tools laid out on a workbench
 * instead of going to the toolbox every time you need something.
 * 
 * The edge detection algorithm remains mathematically identical - we're just
 * accessing the pixel data more efficiently.
 * 
 * @param {Uint8ClampedArray} pixels - Pre-loaded pixel array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} 2D array marking edge pixels
 */
function detectEdgePixelsFromArray(pixels, width, height) {
    // No need to call loadPixels() - we already have the pixel data!
    
    const edgeMap = Array(height).fill().map(() => Array(width).fill(false));
    
    // Define Sobel operators for detecting horizontal and vertical edges
    // These are mathematical "filters" that highlight rapid changes
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    // Process each pixel (except border pixels to avoid edge cases)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            
            let gradientX = 0;
            let gradientY = 0;
            
            // Apply Sobel operators to detect gradients
            // This calculates how much the alpha channel changes in X and Y directions
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    // PERFORMANCE CRITICAL: Direct pixel array access instead of image.get()
                    const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                    const alpha = pixels[pixelIdx + 3]; // Alpha channel
                    
                    gradientX += alpha * sobelX[ky + 1][kx + 1];
                    gradientY += alpha * sobelY[ky + 1][kx + 1];
                }
            }
            
            // Calculate gradient magnitude - how "edgy" this pixel is
            const gradientMagnitude = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
            
            // Mark as edge if gradient is strong enough
            // The threshold determines sensitivity: lower = more edges, higher = fewer edges
            const edgeThreshold = 500; // Tuned for body segmentation masks
            edgeMap[y][x] = gradientMagnitude > edgeThreshold;
        }
    }
    
    return edgeMap;
}



/**
 * Extract contours from edge pixels using connected component analysis
 * 
 * This function doesn't need optimization because it doesn't work with pixel data directly.
 * It operates on the abstract edge map that was created by the optimized edge detection.
 * 
 * Once we have individual edge pixels scattered around, we need to connect them
 * into continuous paths. Think of it like connecting dots in a dot-to-dot puzzle.
 * 
 * This process is crucial because we want smooth, drawable lines rather than
 * a cloud of individual pixels.
 * 
 * @param {Array} edgeMap - 2D array of edge pixels
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} Array of contours, each containing connected points
 */
function extractContours(edgeMap, width, height) {
    const visited = Array(height).fill().map(() => Array(width).fill(false));
    const contours = [];
    
    // Find all connected components of edge pixels
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            
            // If this is an unvisited edge pixel, start a new contour
            if (edgeMap[y][x] && !visited[y][x]) {
                const contour = traceContour(edgeMap, visited, x, y, width, height);
                
                // Only keep contours with enough points to be meaningful
                if (contour.length > 10) {
                    contours.push(contour);
                }
            }
        }
    }
    
    return contours;
}

function traceContour(edgeMap, visited, startX, startY, width, height) {
    const contour = [];
    const stack = [{x: startX, y: startY}];
    
    // Simple 4-connected neighborhood (no diagonals to prevent artifacts)
    const directions = [
        [0, -1], // up
        [1, 0],  // right
        [0, 1],  // down
        [-1, 0]  // left
    ];
    
    while (stack.length > 0) {
        const current = stack.pop();
        const {x, y} = current;
        
        // Skip if already visited or out of bounds
        if (x < 0 || x >= width || y < 0 || y >= height || 
            visited[y][x] || !edgeMap[y][x]) {
            continue;
        }
        
        // Mark as visited and add to contour
        visited[y][x] = true;
        contour.push({x, y});
        
        // Check 4-connected neighbors in a consistent order
        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;
            
            if (newX >= 0 && newX < width && newY >= 0 && newY < height &&
                !visited[newY][newX] && edgeMap[newY][newX]) {
                stack.push({x: newX, y: newY});
            }
        }
    }
    
    return contour;
}

/**
 * Smooth contours to reduce noise and create more natural curves
 * 
 * Raw contours from pixel-level edge detection often look jaggy and unnatural.
 * Smoothing helps create the kind of flowing lines that feel more artistic
 * and pleasing to the eye.
 * 
 * We use a moving average filter, which replaces each point with the average
 * position of nearby points. This is like drawing with a steady hand instead
 * of a shaky one.
 * 
 * No optimization needed here since this works with abstract point coordinates,
 * not pixel data.
 * 
 * @param {Array} contours - Array of raw contours
 * @returns {Array} Array of smoothed contours
 */
function smoothContours(contours) {
    return contours.map(contour => {
        if (contour.length < 5) return contour; // Skip tiny contours
        
        const smoothed = [];
        const windowSize = 3; // Size of smoothing window
        
        for (let i = 0; i < contour.length; i++) {
            let sumX = 0, sumY = 0, count = 0;
            
            // Average nearby points
            for (let j = -windowSize; j <= windowSize; j++) {
                const index = (i + j + contour.length) % contour.length;
                sumX += contour[index].x;
                sumY += contour[index].y;
                count++;
            }
            
            smoothed.push({
                x: sumX / count,
                y: sumY / count
            });
        }
        
        return smoothed;
    });
}

/**
 * Filter contours to remove noise and keep only significant outlines
 * ENHANCED VERSION: More aggressive filtering to eliminate stray lines
 * 
 * The key insight is that body outlines should be the longest, most substantial
 * contours. Small internal artifacts and disconnected line segments should be
 * filtered out aggressively to create clean, readable outlines.
 * 
 * Think of this like editing a sketch - we want the main bold strokes that
 * define the form, not every tiny mark or smudge.
 * 
 * @param {Array} contours - Array of contours to filter
 * @returns {Array} Filtered array of significant contours only
 */
function filterContours(contours) {
    if (contours.length === 0) return contours;
    
    // Sort contours by length (longer contours are more likely to be significant)
    contours.sort((a, b) => b.length - a.length);
    
    // Much more aggressive filtering criteria for cleaner results
    const minLength = 50; // Increased minimum length to filter out small artifacts
    const maxContours = 2; // Only keep the 1-2 longest contours (main body outline)
    
    // Filter out short contours first
    let significantContours = contours.filter(contour => contour.length >= minLength);
    
    // If we have contours, only keep the longest ones (main body outline)
    if (significantContours.length > 0) {
        // Additional filtering: only keep contours that are at least 30% as long as the longest
        const longestLength = significantContours[0].length;
        const lengthThreshold = longestLength * 0.3;
        
        significantContours = significantContours.filter(contour => 
            contour.length >= lengthThreshold
        );
        
        // Limit to maximum number of contours to prevent clutter
        significantContours = significantContours.slice(0, maxContours);
    }
    
    return significantContours;
}

/**
 * Remove straight line artifacts from contours
 * These are the unwanted diagonal lines you see cutting across the outline
 */
function removestraightLineArtifacts(contours) {
    return contours.map(contour => {
        if (contour.length < 10) return contour; // Too short to analyze
        
        let filteredPoints = [];
        
        for (let i = 0; i < contour.length; i++) {
            let shouldKeep = true;
            
            // Look ahead and behind to detect straight line segments
            if (i >= 4 && i < contour.length - 4) {
                let startPoint = contour[i - 4];
                let endPoint = contour[i + 4];
                let currentPoint = contour[i];
                
                // Calculate if this section is too straight
                let straightLineDistance = dist(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
                let actualPathDistance = 0;
                for (let j = i - 4; j < i + 4; j++) {
                    actualPathDistance += dist(contour[j].x, contour[j].y, contour[j + 1].x, contour[j + 1].y);
                }
                
                // If the path is almost perfectly straight, it's likely an artifact
                let straightnessRatio = straightLineDistance / actualPathDistance;
                if (straightnessRatio > 0.95) { // 95% straight = artifact
                    shouldKeep = false;
                }
            }
            
            if (shouldKeep) {
                filteredPoints.push(contour[i]);
            }
        }
        
        return filteredPoints;
    }).filter(contour => contour.length > 20); // Remove contours that became too short
}

/**
 * Draw edges on the canvas with specified style
 * 
 * This function takes our processed contours and renders them visually.
 * It handles the artistic rendering of the detected edges, creating
 * the visual outline effect that users see.
 * 
 * No optimization needed here since this is a drawing operation, not pixel processing.
 * 
 * @param {Array} contours - Array of contours to draw
 * @param {p5.Color} edgeColor - Color to draw the edges
 * @param {number} thickness - Line thickness
 */
function drawEdges(contours, edgeColor, thickness = 2) {
    if (!contours || contours.length === 0) return;
    
    stroke(edgeColor);
    strokeWeight(thickness);
    noFill();
    // remove first and last contour
    // console.log(contours)
    // contours = contours;

    // contours = contours.slice(1, contours.length - 1);
    // console.log(contours)

    // Draw each contour as a connected path
    for (let contour of contours) {
        if (contour.length < 2) continue;
        // console.log(contour);
            contour = contour.slice(1, contour.length - 1);

        beginShape();
        for (const point of contour) {
            vertex(point.x, point.y);
        }
        endShape(CLOSE); // Close the path to create a complete outline
    }
}

/**
 * Get contour information for debugging and analysis
 * 
 * This utility function provides insights into the edge detection results,
 * which can be helpful for debugging and understanding how well the
 * detection is working.
 * 
 * No optimization needed here since this is a utility/debugging function.
 * 
 * @param {Array} contours - Array of contours to analyze
 * @returns {Object} Analysis results
 */
function analyzeContours(contours) {
    if (!contours || contours.length === 0) {
        return {totalContours: 0, totalPoints: 0, averageLength: 0};
    }
    
    const totalPoints = contours.reduce((sum, contour) => sum + contour.length, 0);
    const averageLength = totalPoints / contours.length;
    
    return {
        totalContours: contours.length,
        totalPoints: totalPoints,
        averageLength: Math.round(averageLength),
        longestContour: Math.max(...contours.map(c => c.length))
    };
}