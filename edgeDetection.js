/*
 * edgeDetection.js - Advanced Edge Detection for Body Outlines
 * 
 * This module implements sophisticated edge detection techniques to extract
 * clean, drawable outlines from body segmentation masks. Think of this as
 * converting a "filled silhouette" into a "pencil outline."
 * 
 * Key Computer Vision Concepts:
 * - Edge detection finds boundaries between different regions
 * - We use gradient-based methods to find rapid changes in pixel values
 * - Contour following creates connected lines from scattered edge points
 * - Smoothing reduces noise while preserving important shape features
 * 
 * The process flows like this:
 * Segmentation Mask → Edge Detection → Contour Extraction → Smoothing → Drawable Path
 */

/**
 * Extract edges from a segmentation mask and return drawable path data
 * 
 * This is our main function that orchestrates the entire edge detection process.
 * We start with a binary mask (person = opaque, background = transparent) and
 * end with smooth, connected paths that represent the person's outline.
 * 
 * The multi-step process ensures we get clean, artistic-looking edges rather
 * than jaggy, pixelated boundaries.
 * 
 * @param {p5.Image} mask - The segmentation mask from body detection
 * @returns {Array} Array of edge paths, each containing connected points
 */
function extractEdgesFromMask(mask) {
    if (!mask || mask.width === 0 || mask.height === 0) {
        return null;
    }
    
    console.log("🔍 Starting edge detection process...");
    
    // Step 1: Create an edge map using gradient detection
    // This finds pixels where the mask changes from person to background
    const edgeMap = detectEdgePixels(mask);
    
    // Step 2: Extract contours from the edge pixels
    // This connects scattered edge pixels into continuous paths
    const contours = extractContours(edgeMap, mask.width, mask.height);
    
    // Step 3: Smooth and optimize the contours
    // This reduces noise and creates more natural-looking curves
    const smoothedContours = smoothContours(contours);
    
    // Step 4: Filter out tiny contours that are likely noise
    const filteredContours = filterContours(smoothedContours);
    
    // console.log(`✅ Edge detection complete: ${filteredContours.length} contours found`);
    
    return filteredContours;
}

/**
 * Detect edge pixels using gradient-based edge detection
 * 
 * Edge detection works by finding places where the pixel values change rapidly.
 * In our case, we're looking for the boundary between the person (high alpha)
 * and the background (low alpha). This is similar to how your eye detects
 * the edge of an object - it's where one thing stops and another begins.
 * 
 * We use a Sobel-like operator, which is essentially asking:
 * "How different is this pixel from its neighbors?"
 * 
 * @param {p5.Image} mask - The segmentation mask
 * @returns {Array} 2D array marking edge pixels
 */
function detectEdgePixels(mask) {
    mask.loadPixels(); // Load pixels ONCE for efficiency
    
    const width = mask.width;
    const height = mask.height;
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
                    const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                    const alpha = mask.pixels[pixelIdx + 3]; // Alpha channel
                    
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

/**
 * Trace a single contour starting from an edge pixel
 * 
 * This function follows connected edge pixels to build a continuous path.
 * It's like following a trail of breadcrumbs, where each edge pixel leads
 * to the next connected edge pixel.
 * 
 * We use a flood-fill-like algorithm, but instead of filling an area,
 * we're recording the path we take.
 * 
 * @param {Array} edgeMap - 2D array of edge pixels
 * @param {Array} visited - 2D array tracking visited pixels
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} Array of connected points forming a contour
 */
function traceContour(edgeMap, visited, startX, startY, width, height) {
    const contour = [];
    const stack = [{x: startX, y: startY}];
    
    // Define 8-connected neighborhood (including diagonals)
    // This means we can connect to any of the 8 adjacent pixels
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
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
        
        // Check all 8 neighbors for connected edge pixels
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
 * 
 * Not all contours are created equal. Some represent the main body outline,
 * while others might be tiny artifacts from noise in the segmentation.
 * This function keeps only the contours that are likely to represent
 * meaningful parts of the person's silhouette.
 * 
 * @param {Array} contours - Array of contours to filter
 * @returns {Array} Filtered array of significant contours
 */
function filterContours(contours) {
    // Sort contours by length (longer contours are more likely to be important)
    contours.sort((a, b) => b.length - a.length);
    
    // Filter criteria
    const minLength = 20; // Minimum number of points in a significant contour
    const maxContours = 5; // Maximum number of contours to keep
    
    return contours
        .filter(contour => contour.length >= minLength)
        .slice(0, maxContours); // Keep only the longest, most significant contours
}

/**
 * Draw edges on the canvas with specified style
 * 
 * This function takes our processed contours and renders them visually.
 * It handles the artistic rendering of the detected edges, creating
 * the visual outline effect that users see.
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
    
    // Draw each contour as a connected path
    for (const contour of contours) {
        if (contour.length < 2) continue;
        
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