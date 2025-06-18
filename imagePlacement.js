/*
 * imagePlacement.js - Advanced Rectangle Packing in Irregular Shapes
 * 
 * This module solves one of the most interesting problems in computational geometry:
 * How do you optimally pack rectangles inside an irregular, curved boundary?
 * 
 * Think of this like arranging furniture in a room with curved walls, or fitting
 * puzzle pieces into a complex shape. We need to consider multiple factors:
 * - Maximizing space utilization (bigger rectangles are better)
 * - Avoiding overlaps (rectangles can't intersect)
 * - Staying within boundaries (all rectangles must be inside the body outline)
 * - Visual spacing (rectangles shouldn't touch - leave breathing room)
 * - Balanced distribution (spread rectangles across the available space)
 * 
 * The algorithm uses several computational geometry techniques:
 * 1. Point-in-polygon testing to determine valid placement areas
 * 2. Collision detection to prevent overlaps
 * 3. Iterative optimization to find good rectangle sizes and positions
 * 4. Spatial partitioning to improve performance
 * 
 * This is similar to problems solved in:
 * - Video game sprite placement
 * - Automated layout design
 * - Manufacturing optimization (cutting shapes from materials)
 * - Urban planning (fitting buildings in available lots)
 */

// Configuration constants for the placement algorithm
const PLACEMENT_CONFIG = {
    minImageSize: 50,        // Minimum size for any placed rectangle
    maxImageSize: 150,       // Maximum size for any placed rectangle
    minSpacing: 10,          // Minimum distance between rectangles
    maxAttempts: 100,        // Maximum placement attempts per rectangle
    sampleDensity: 5,        // How densely to sample the interior space
    aspectRatios: [          // Preferred aspect ratios for variety
        1.0,    // Square
        1.5,    // Slightly rectangular
        0.67,   // Slightly tall
        1.33,   // Slightly wide
        0.8     // Moderately tall
    ]
};

/**
 * Main function to place images optimally within a body outline
 * 
 * This is the orchestrator function that coordinates the entire placement process.
 * It takes the detected body contours and returns a set of rectangles positioned
 * to fill the space efficiently while looking aesthetically pleasing.
 * 
 * The algorithm works in phases:
 * 1. Analyze the shape to understand the available space
 * 2. Generate candidate positions using spatial sampling
 * 3. Iteratively place rectangles, starting with larger ones
 * 4. Optimize placement through local adjustments
 * 
 * @param {Array} contours - Array of contour paths defining the body outline
 * @param {number} targetCount - Desired number of images to place
 * @returns {Array} Array of rectangle objects with position and size information
 */
function placeImagesInBodyOutline(contours, targetCount = 7) {
    console.log(`🎯 Starting image placement: targeting ${targetCount} images`);
    
    if (!contours || contours.length === 0) {
        console.warn("⚠️ No contours provided for image placement");
        return [];
    }
    
    // Phase 1: Analyze the shape and identify valid placement areas
    const shapeInfo = analyzeShapeGeometry(contours);
    console.log(`📐 Shape analysis: ${shapeInfo.validPoints.length} valid placement points found`);
    
    // Phase 2: Generate an optimal set of rectangle specifications
    const rectangleSpecs = generateOptimalRectangleSet(shapeInfo, targetCount);
    console.log(`📋 Generated ${rectangleSpecs.length} rectangle specifications`);
    
    // Phase 3: Place rectangles using iterative optimization
    const placedRectangles = placeRectanglesIteratively(rectangleSpecs, shapeInfo);
    console.log(`✅ Successfully placed ${placedRectangles.length} rectangles`);
    
    // Phase 4: Fine-tune positions for better visual distribution
    const optimizedRectangles = optimizePlacement(placedRectangles, shapeInfo);
    
    return optimizedRectangles;
}

/**
 * Analyze the geometric properties of the body outline shape
 * 
 * Before we can place rectangles effectively, we need to understand the shape
 * we're working with. This function creates a detailed map of where rectangles
 * can be placed and what sizes might work in different areas.
 * 
 * Think of this like a surveyor mapping a plot of land before construction.
 * We need to know where it's safe to build, where the boundaries are,
 * and what constraints we're working with.
 * 
 * @param {Array} contours - The body outline contours
 * @returns {Object} Comprehensive shape analysis with placement data
 */
function analyzeShapeGeometry(contours) {
    // Find the bounding box that contains all contours
    const bounds = calculateBoundingBox(contours);
    console.log(`📦 Bounding box: ${bounds.width}x${bounds.height}`);
    
    // Sample the interior space to find valid placement areas
    // This creates a grid of test points throughout the shape
    const validPoints = sampleInteriorSpace(contours, bounds);
    
    // Calculate local space availability at each valid point
    // This tells us how much room we have for rectangles at different locations
    const spaceMap = calculateLocalSpaceAvailability(validPoints, contours, bounds);
    
    // Identify clusters of available space for strategic placement
    const spaceClusters = identifySpaceClusters(spaceMap);
    
    return {
        bounds: bounds,
        validPoints: validPoints,
        spaceMap: spaceMap,
        spaceClusters: spaceClusters,
        contours: contours,
        totalArea: estimateShapeArea(contours, bounds)
    };
}

/**
 * Calculate the bounding rectangle that contains all contours
 * 
 * The bounding box gives us the overall dimensions of the shape we're working with.
 * This is essential for setting up our coordinate system and understanding
 * the scale of the placement problem.
 * 
 * @param {Array} contours - Array of contour paths
 * @returns {Object} Bounding box with x, y, width, height properties
 */
function calculateBoundingBox(contours) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // Examine every point in every contour to find the extremes
    for (const contour of contours) {
        for (const point of contour) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
    }
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * Sample the interior space to find valid placement points
 * 
 * This function creates a systematic sample of points throughout the shape
 * and tests whether each point is inside the body outline. Think of it like
 * dropping pins on a map and keeping only the ones that land inside the territory.
 * 
 * We use point-in-polygon testing, which is a fundamental algorithm in
 * computational geometry. The "ray casting" method works by drawing an
 * imaginary line from the test point to infinity and counting how many
 * times it crosses the polygon boundary.
 * 
 * @param {Array} contours - Body outline contours
 * @param {Object} bounds - Bounding box of the shape
 * @returns {Array} Array of points that are inside the body outline
 */
function sampleInteriorSpace(contours, bounds) {
    const validPoints = [];
    const step = PLACEMENT_CONFIG.sampleDensity;
    
    // Create a grid of test points across the bounding box
    for (let y = bounds.y; y < bounds.y + bounds.height; y += step) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x += step) {
            
            // Test if this point is inside any of the contours
            // We assume the largest contour is the main body outline
            if (isPointInsideShape(x, y, contours)) {
                validPoints.push({x, y, localSpace: 0}); // localSpace will be calculated later
            }
        }
    }
    
    return validPoints;
}

/**
 * Test if a point is inside the body shape using ray casting algorithm
 * 
 * The ray casting algorithm is one of the most elegant solutions in computational
 * geometry. Here's how it works: imagine standing at the test point and shining
 * a flashlight in any direction (we'll use horizontal). Count how many polygon
 * edges the light beam crosses. If it's an odd number, you're inside; if even,
 * you're outside.
 * 
 * Why does this work? Every time you cross a boundary, you switch from inside
 * to outside or vice versa. If you end up having crossed an odd number of
 * boundaries, you must have started inside.
 * 
 * @param {number} testX - X coordinate of test point
 * @param {number} testY - Y coordinate of test point
 * @param {Array} contours - Array of polygon contours
 * @returns {boolean} True if point is inside the shape
 */
function isPointInsideShape(testX, testY, contours) {
    // Test against the largest contour (assumed to be the main body outline)
    if (contours.length === 0) return false;
    
    // Find the largest contour by number of points
    const mainContour = contours.reduce((largest, current) => 
        current.length > largest.length ? current : largest
    );
    
    let intersectionCount = 0;
    
    // Cast a ray from the test point to the right (positive X direction)
    for (let i = 0; i < mainContour.length; i++) {
        const current = mainContour[i];
        const next = mainContour[(i + 1) % mainContour.length]; // Wrap around to first point
        
        // Check if the ray intersects this edge
        // We only count intersections where the ray actually crosses the edge
        if (((current.y > testY) !== (next.y > testY)) &&
            (testX < (next.x - current.x) * (testY - current.y) / (next.y - current.y) + current.x)) {
            intersectionCount++;
        }
    }
    
    // Point is inside if intersection count is odd
    return intersectionCount % 2 === 1;
}

/**
 * Calculate how much space is available around each valid point
 * 
 * Not all interior points are created equal. Some are near the center of large
 * open areas where we could place big rectangles, while others are in narrow
 * corridors where only small rectangles would fit.
 * 
 * This function estimates the "local space availability" by testing how far
 * we can extend in different directions before hitting a boundary. It's like
 * stretching your arms out and seeing how much room you have around you.
 * 
 * @param {Array} validPoints - Points inside the shape
 * @param {Array} contours - Shape contours for boundary testing
 * @param {Object} bounds - Bounding box for optimization
 * @returns {Array} Points with local space information added
 */
function calculateLocalSpaceAvailability(validPoints, contours, bounds) {
    return validPoints.map(point => {
        // Test how far we can extend in each direction
        const testDirections = [
            {dx: 1, dy: 0},   // Right
            {dx: -1, dy: 0},  // Left
            {dx: 0, dy: 1},   // Down
            {dx: 0, dy: -1},  // Up
            {dx: 1, dy: 1},   // Diagonal down-right
            {dx: -1, dy: -1}, // Diagonal up-left
            {dx: 1, dy: -1},  // Diagonal up-right
            {dx: -1, dy: 1}   // Diagonal down-left
        ];
        
        let totalSpace = 0;
        
        for (const direction of testDirections) {
            let distance = 0;
            let testX = point.x;
            let testY = point.y;
            
            // March in this direction until we hit a boundary
            while (distance < 100 && // Reasonable maximum
                   isPointInsideShape(testX, testY, contours)) {
                distance += 2; // Step size
                testX += direction.dx * 2;
                testY += direction.dy * 2;
            }
            
            totalSpace += distance;
        }
        
        // Calculate average available space in all directions
        const averageSpace = totalSpace / testDirections.length;
        
        return {
            x: point.x,
            y: point.y,
            localSpace: averageSpace
        };
    });
}

/**
 * Generate optimal rectangle specifications based on available space
 * 
 * This function decides what sizes and aspect ratios of rectangles to create
 * based on the shape analysis. The goal is to create a diverse set of rectangles
 * that will efficiently fill the available space while maintaining visual interest.
 * 
 * We consider factors like:
 * - Total available area (bigger shapes can accommodate more/larger rectangles)
 * - Space distribution (clustered vs. spread out space affects size choices)
 * - Visual variety (mix of sizes and shapes looks more interesting)
 * 
 * @param {Object} shapeInfo - Complete shape analysis data
 * @param {number} targetCount - Desired number of rectangles
 * @returns {Array} Array of rectangle specifications with size and aspect ratio
 */
function generateOptimalRectangleSet(shapeInfo, targetCount) {
    const specs = [];
    
    // Calculate size distribution based on available space
    const spaceValues = shapeInfo.spaceMap.map(p => p.localSpace);
    const maxSpace = Math.max(...spaceValues);
    const averageSpace = spaceValues.reduce((a, b) => a + b, 0) / spaceValues.length;
    
    // Generate rectangles with varying sizes
    // We want a mix: some large rectangles to fill major areas,
    // some medium rectangles for good coverage,
    // and some small rectangles to fill remaining gaps
    const sizeDistribution = [
        { ratio: 0.3, sizeMultiplier: 0.8 },  // 30% large rectangles
        { ratio: 0.4, sizeMultiplier: 0.6 },  // 40% medium rectangles
        { ratio: 0.3, sizeMultiplier: 0.4 }   // 30% small rectangles
    ];
    
    for (const dist of sizeDistribution) {
        const count = Math.round(targetCount * dist.ratio);
        
        for (let i = 0; i < count; i++) {
            // Calculate base size from available space
            const baseSize = Math.min(
                Math.max(averageSpace * dist.sizeMultiplier, PLACEMENT_CONFIG.minImageSize),
                PLACEMENT_CONFIG.maxImageSize
            );
            
            // Choose a random aspect ratio for variety
            const aspectRatio = PLACEMENT_CONFIG.aspectRatios[
                Math.floor(Math.random() * PLACEMENT_CONFIG.aspectRatios.length)
            ];
            
            specs.push({
                width: baseSize * aspectRatio,
                height: baseSize / aspectRatio,
                aspectRatio: aspectRatio,
                priority: dist.sizeMultiplier // Larger rectangles get higher priority
            });
        }
    }
    
    // Sort by priority (place larger rectangles first)
    specs.sort((a, b) => b.priority - a.priority);
    
    return specs;
}

/**
 * Place rectangles iteratively using collision detection and optimization
 * 
 * This is where the rubber meets the road. We take our rectangle specifications
 * and try to find good positions for each one. The algorithm uses several
 * strategies to ensure successful placement:
 * 
 * 1. Priority-based placement (larger rectangles first)
 * 2. Multiple placement attempts with random variation
 * 3. Collision detection to prevent overlaps
 * 4. Boundary validation to ensure rectangles stay inside the shape
 * 5. Progressive size reduction if placement fails
 * 
 * Think of this like playing Tetris, but instead of pieces falling from above,
 * we're strategically choosing where to place each piece for optimal packing.
 * 
 * @param {Array} specs - Rectangle specifications to place
 * @param {Object} shapeInfo - Shape analysis data
 * @returns {Array} Successfully placed rectangles with positions
 */
function placeRectanglesIteratively(specs, shapeInfo) {
    const placedRectangles = [];
    
    for (let specIndex = 0; specIndex < specs.length; specIndex++) {
        const spec = specs[specIndex];
        let placed = false;
        let attempts = 0;
        let currentWidth = spec.width;
        let currentHeight = spec.height;
        
        // Try to place this rectangle
        while (!placed && attempts < PLACEMENT_CONFIG.maxAttempts) {
            attempts++;
            
            // Choose a random valid point as a potential center
            const candidatePoints = shapeInfo.spaceMap.filter(p => 
                p.localSpace >= Math.min(currentWidth, currentHeight) / 2
            );
            
            if (candidatePoints.length === 0) {
                // If no suitable points, try smaller size
                currentWidth *= 0.9;
                currentHeight *= 0.9;
                
                if (currentWidth < PLACEMENT_CONFIG.minImageSize) {
                    console.log(`⚠️ Could not place rectangle ${specIndex} - no suitable space`);
                    break;
                }
                continue;
            }
            
            // Pick a random candidate point
            const centerPoint = candidatePoints[Math.floor(Math.random() * candidatePoints.length)];
            
            // Create rectangle centered at this point
            const rectangle = {
                x: centerPoint.x - currentWidth / 2,
                y: centerPoint.y - currentHeight / 2,
                width: currentWidth,
                height: currentHeight,
                centerX: centerPoint.x,
                centerY: centerPoint.y
            };
            
            // Check if this placement is valid
            if (isRectanglePlacementValid(rectangle, placedRectangles, shapeInfo)) {
                placedRectangles.push(rectangle);
                placed = true;
                console.log(`✅ Placed rectangle ${specIndex} at (${Math.round(rectangle.x)}, ${Math.round(rectangle.y)})`);
            }
        }
        
        if (!placed) {
            console.log(`❌ Failed to place rectangle ${specIndex} after ${attempts} attempts`);
        }
    }
    
    return placedRectangles;
}

/**
 * Validate if a rectangle placement is acceptable
 * 
 * This comprehensive validation function checks multiple criteria to ensure
 * a rectangle placement is both geometrically valid and aesthetically pleasing.
 * It's like having a quality control inspector check each placement.
 * 
 * The validation covers:
 * - Boundary compliance (rectangle must be fully inside the shape)
 * - Collision avoidance (no overlap with existing rectangles)
 * - Minimum spacing (maintaining visual breathing room)
 * - Size reasonableness (not too small to be meaningful)
 * 
 * @param {Object} rectangle - Rectangle to validate
 * @param {Array} existingRectangles - Already placed rectangles
 * @param {Object} shapeInfo - Shape boundary information
 * @returns {boolean} True if placement is valid
 */
function isRectanglePlacementValid(rectangle, existingRectangles, shapeInfo) {
    // Test 1: Rectangle must be fully inside the shape boundary
    if (!isRectangleInsideShape(rectangle, shapeInfo.contours)) {
        return false;
    }
    
    // Test 2: Rectangle must not overlap with any existing rectangles
    if (hasRectangleCollision(rectangle, existingRectangles)) {
        return false;
    }
    
    // Test 3: Rectangle must maintain minimum spacing from existing rectangles
    if (!maintainsMinimumSpacing(rectangle, existingRectangles)) {
        return false;
    }
    
    // All tests passed
    return true;
}

/**
 * Test if a rectangle is completely inside the shape boundary
 * 
 * For a rectangle to be validly placed, every corner must be inside the shape.
 * We also test a few points along the edges and center for extra confidence,
 * since the shape boundary might curve between corner points.
 * 
 * @param {Object} rectangle - Rectangle to test
 * @param {Array} contours - Shape boundary contours
 * @returns {boolean} True if rectangle is fully inside
 */
function isRectangleInsideShape(rectangle, contours) {
    // Test all four corners
    const corners = [
        {x: rectangle.x, y: rectangle.y},                                    // Top-left
        {x: rectangle.x + rectangle.width, y: rectangle.y},                 // Top-right
        {x: rectangle.x, y: rectangle.y + rectangle.height},               // Bottom-left
        {x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height} // Bottom-right
    ];
    
    for (const corner of corners) {
        if (!isPointInsideShape(corner.x, corner.y, contours)) {
            return false;
        }
    }
    
    // Test edge midpoints for curved boundaries
    const edgeMidpoints = [
        {x: rectangle.x + rectangle.width/2, y: rectangle.y},                    // Top edge
        {x: rectangle.x + rectangle.width/2, y: rectangle.y + rectangle.height}, // Bottom edge
        {x: rectangle.x, y: rectangle.y + rectangle.height/2},                   // Left edge
        {x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height/2}  // Right edge
    ];
    
    for (const point of edgeMidpoints) {
        if (!isPointInsideShape(point.x, point.y, contours)) {
            return false;
        }
    }
    
    // Test center point
    const center = {x: rectangle.x + rectangle.width/2, y: rectangle.y + rectangle.height/2};
    return isPointInsideShape(center.x, center.y, contours);
}

/**
 * Check if a rectangle collides with any existing rectangles
 * 
 * Collision detection between axis-aligned rectangles is straightforward:
 * two rectangles overlap if they overlap in both X and Y dimensions.
 * 
 * This is much simpler than general polygon collision detection, which is
 * one of the advantages of restricting ourselves to rectangles.
 * 
 * @param {Object} rectangle - Rectangle to test
 * @param {Array} existingRectangles - Already placed rectangles
 * @returns {boolean} True if collision detected
 */
function hasRectangleCollision(rectangle, existingRectangles) {
    for (const existing of existingRectangles) {
        // Check for overlap in both X and Y dimensions
        const xOverlap = rectangle.x < existing.x + existing.width && 
                        rectangle.x + rectangle.width > existing.x;
        
        const yOverlap = rectangle.y < existing.y + existing.height && 
                        rectangle.y + rectangle.height > existing.y;
        
        if (xOverlap && yOverlap) {
            return true; // Collision detected
        }
    }
    
    return false; // No collisions
}

/**
 * Check if rectangle maintains minimum spacing from existing rectangles
 * 
 * Even if rectangles don't overlap, they might be too close together for
 * good visual appearance. This function ensures adequate spacing between
 * elements, creating a more pleasing and readable layout.
 * 
 * @param {Object} rectangle - Rectangle to test
 * @param {Array} existingRectangles - Already placed rectangles
 * @returns {boolean} True if minimum spacing is maintained
 */
function maintainsMinimumSpacing(rectangle, existingRectangles) {
    const minSpacing = PLACEMENT_CONFIG.minSpacing;
    
    for (const existing of existingRectangles) {
        // Calculate distance between rectangle edges
        const xDistance = Math.max(0, 
            Math.max(rectangle.x - (existing.x + existing.width),
                    existing.x - (rectangle.x + rectangle.width)));
        
        const yDistance = Math.max(0,
            Math.max(rectangle.y - (existing.y + existing.height),
                    existing.y - (rectangle.y + rectangle.height)));
        
        // If rectangles are adjacent, check edge-to-edge distance
        // If rectangles are diagonal, check corner-to-corner distance
        const actualDistance = (xDistance === 0 || yDistance === 0) ?
            Math.max(xDistance, yDistance) :
            Math.sqrt(xDistance * xDistance + yDistance * yDistance);
        
        if (actualDistance < minSpacing) {
            return false; // Too close
        }
    }
    
    return true; // Adequate spacing maintained
}

/**
 * Optimize placement through local adjustments and fine-tuning
 * 
 * After initial placement, we can often improve the layout through small
 * adjustments. This function applies several optimization techniques:
 * 
 * - Center balancing: Adjust positions to better balance the overall composition
 * - Space utilization: Move rectangles slightly to make better use of available space
 * - Visual harmony: Align rectangles when it improves the overall appearance
 * 
 * Think of this like arranging furniture in a room - after placing everything,
 * you might nudge items a bit to create better flow and visual balance.
 * 
 * @param {Array} rectangles - Placed rectangles to optimize
 * @param {Object} shapeInfo - Shape analysis data
 * @returns {Array} Optimized rectangle positions
 */
function optimizePlacement(rectangles, shapeInfo) {
    // For this implementation, we'll apply a simple optimization:
    // slightly spread rectangles apart if they're clustered too tightly
    
    const optimized = rectangles.map(rect => ({...rect})); // Create copies
    
    // Calculate center of mass of all rectangles
    const centerOfMass = {
        x: optimized.reduce((sum, rect) => sum + rect.centerX, 0) / optimized.length,
        y: optimized.reduce((sum, rect) => sum + rect.centerY, 0) / optimized.length
    };
    
    // Apply gentle spreading force to reduce clustering
    for (let i = 0; i < optimized.length; i++) {
        const rect = optimized[i];
        
        // Calculate vector from center of mass to this rectangle
        const dx = rect.centerX - centerOfMass.x;
        const dy = rect.centerY - centerOfMass.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Apply small outward adjustment
            const adjustmentStrength = 3; // Pixels
            const adjustX = (dx / distance) * adjustmentStrength;
            const adjustY = (dy / distance) * adjustmentStrength;
            
            // Create adjusted rectangle
            const adjustedRect = {
                x: rect.x + adjustX,
                y: rect.y + adjustY,
                width: rect.width,
                height: rect.height,
                centerX: rect.centerX + adjustX,
                centerY: rect.centerY + adjustY
            };
            
            // Only apply adjustment if it maintains validity
            if (isRectanglePlacementValid(adjustedRect, 
                optimized.filter((_, index) => index !== i), shapeInfo)) {
                optimized[i] = adjustedRect;
            }
        }
    }
    
    console.log(`🔧 Placement optimization complete`);
    return optimized;
}

// Utility functions for shape analysis and spatial calculations

function identifySpaceClusters(spaceMap) {
    // Simple clustering based on local space availability
    // This could be enhanced with more sophisticated clustering algorithms
    return spaceMap.filter(point => point.localSpace > 30)
                  .sort((a, b) => b.localSpace - a.localSpace);
}

function estimateShapeArea(contours, bounds) {
    // Rough area estimation using bounding box and fill ratio
    // A more precise calculation would use polygon area formulas
    return bounds.width * bounds.height * 0.6; // Estimate 60% fill ratio for human silhouette
}