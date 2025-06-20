/*
 * imagePlacement.js - Advanced Rectangle Packing with Real Image Aspect Ratios
 * 
 * Updated to work with actual loaded images, respecting their native proportions
 * while still optimizing placement within irregular body shapes.
 */

// Configuration constants for the placement algorithm
const PLACEMENT_CONFIG = {
    minImageSize: 80,        // Minimum size for any placed rectangle
    maxImageSize: 320,       // Maximum size for any placed rectangle  
    minSpacing: 8,           // Minimum distance between rectangles
    maxAttempts: 50,        // More attempts since we're working with specific ratios
    sampleDensity: 10,        // Slightly denser sampling for better placement
};

/**
 * Main function to place images optimally within a body outline
 * Now accepts an array of loaded images with their natural aspect ratios
 * 
 * @param {Array} contours - Array of contour paths defining the body outline
 * @param {Array} availableImages - Array of loaded p5.Image objects
 * @param {number} targetCount - Desired number of images to place
 * @returns {Array} Array of rectangle objects with position, size, and image assignment
 */
function placeImagesInBodyOutline(contours, availableImages = [], targetCount = 7) {
    // console.log(`🎯 Starting image placement: targeting ${targetCount} images from ${availableImages.length} available`);
    
    if (!contours || contours.length === 0) {
        // console.warn("⚠️ No contours provided for image placement");
        return [];
    }
    
    // Phase 1: Analyze the shape and identify valid placement areas
    const shapeInfo = analyzeShapeGeometry(contours);
    // console.log(`📐 Shape analysis: ${shapeInfo.validPoints.length} valid placement points found`);
    
    // Phase 2: Generate rectangle specifications based on actual image aspect ratios
    const rectangleSpecs = generateImageBasedRectangleSet(shapeInfo, availableImages, targetCount);
    // console.log(`📋 Generated ${rectangleSpecs.length} rectangle specifications from real images`);
    
    // Phase 3: Place rectangles using iterative optimization
    const placedRectangles = placeRectanglesIteratively(rectangleSpecs, shapeInfo);
    // console.log(`✅ Successfully placed ${placedRectangles.length} rectangles`);
    
    // Phase 4: Fine-tune positions for better visual distribution
    const optimizedRectangles = optimizePlacement(placedRectangles, shapeInfo);
    
    return optimizedRectangles;
}

/**
 * Generate rectangle specifications based on actual loaded images
 * 
 * This is where we make the crucial shift from arbitrary rectangles to 
 * rectangles that match your real photographs. We calculate the aspect 
 * ratio of each image and create placement specifications that will 
 * preserve those natural proportions.
 * 
 * Think of this like a photo printing service - we want to scale your 
 * images to fit the available space, but never stretch or squash them 
 * in ways that would distort the original composition.
 * 
 * @param {Object} shapeInfo - Complete shape analysis data
 * @param {Array} availableImages - Array of loaded p5.Image objects
 * @param {number} targetCount - Desired number of rectangles
 * @returns {Array} Array of rectangle specifications with image assignments
 */
function generateImageBasedRectangleSet(shapeInfo, availableImages, targetCount) {
    const specs = [];
    
    // If no images are loaded, fall back to the original system
    if (availableImages.length === 0) {
        console.warn("No images loaded - using fallback rectangles");
        return generateFallbackRectangleSet(shapeInfo, targetCount);
    }
    
    // Calculate available space characteristics
    const spaceValues = shapeInfo.spaceMap.map(p => p.localSpace);
    const maxSpace = Math.max(...spaceValues);
    const averageSpace = spaceValues.reduce((a, b) => a + b, 0) / spaceValues.length;
    
    // Create size distribution - we want variety in sizes for visual interest
    const sizeDistribution = [
        { ratio: 0.25, sizeMultiplier: 0.9 },  // 25% large images
        { ratio: 0.45, sizeMultiplier: 0.7 },  // 45% medium images  
        { ratio: 0.30, sizeMultiplier: 0.5 }   // 30% small images
    ];
    
    for (const dist of sizeDistribution) {
        const count = Math.round(targetCount * dist.ratio);
        
        for (let i = 0; i < count; i++) {
            // Select a random image from available images
            const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            
            // Calculate the natural aspect ratio of this image
            const imageAspectRatio = selectedImage.width / selectedImage.height;
            
            // Determine base size from available space
            const baseSize = Math.min(
                Math.max(averageSpace * dist.sizeMultiplier, PLACEMENT_CONFIG.minImageSize),
                PLACEMENT_CONFIG.maxImageSize
            );
            
            // Create rectangle dimensions that preserve the image's aspect ratio
            let rectWidth, rectHeight;
            
            if (imageAspectRatio > 1) {
                // Landscape image - width is the limiting factor
                rectWidth = baseSize;
                rectHeight = baseSize / imageAspectRatio;
            } else {
                // Portrait or square image - height is the limiting factor  
                rectHeight = baseSize;
                rectWidth = baseSize * imageAspectRatio;
            }
            
            specs.push({
                width: rectWidth,
                height: rectHeight,
                aspectRatio: imageAspectRatio,
                assignedImage: selectedImage,
                priority: dist.sizeMultiplier,
                originalImageWidth: selectedImage.width,
                originalImageHeight: selectedImage.height
            });
        }
    }
    
    // Sort by priority (larger rectangles get placed first for better packing)
    specs.sort((a, b) => b.priority - a.priority);
    
    console.log(`Generated specs with aspect ratios: ${specs.map(s => s.aspectRatio.toFixed(2)).join(', ')}`);
    
    return specs;
}

/**
 * Fallback rectangle generation when no images are available
 * 
 * This preserves the original functionality for development and testing,
 * creating rectangles with pleasant proportions even without loaded images.
 */
function generateFallbackRectangleSet(shapeInfo, targetCount) {
    const specs = [];
    const spaceValues = shapeInfo.spaceMap.map(p => p.localSpace);
    const maxSpace = Math.max(...spaceValues);
    const averageSpace = spaceValues.reduce((a, b) => a + b, 0) / spaceValues.length;
    
    // Use pleasing aspect ratios for fallback rectangles
    const fallbackAspectRatios = [1.0, 1.5, 0.67, 1.33, 0.8, 1.25];
    
    const sizeDistribution = [
        { ratio: 0.3, sizeMultiplier: 0.8 },
        { ratio: 0.4, sizeMultiplier: 0.6 },
        { ratio: 0.3, sizeMultiplier: 0.4 }
    ];
    
    for (const dist of sizeDistribution) {
        const count = Math.round(targetCount * dist.ratio);
        
        for (let i = 0; i < count; i++) {
            const baseSize = Math.min(
                Math.max(averageSpace * dist.sizeMultiplier, PLACEMENT_CONFIG.minImageSize),
                PLACEMENT_CONFIG.maxImageSize
            );
            
            const aspectRatio = fallbackAspectRatios[Math.floor(Math.random() * fallbackAspectRatios.length)];
            
            specs.push({
                width: baseSize * aspectRatio,
                height: baseSize / aspectRatio,
                aspectRatio: aspectRatio,
                assignedImage: null, // No image assigned
                priority: dist.sizeMultiplier
            });
        }
    }
    
    specs.sort((a, b) => b.priority - a.priority);
    return specs;
}

/**
 * Enhanced rectangle placement validation for image-based rectangles
 * 
 * This builds on the existing validation but adds considerations specific
 * to working with real images that have fixed aspect ratios.
 */
function isRectanglePlacementValid(rectangle, existingRectangles, shapeInfo) {
    // All the original validation still applies
    if (!isRectangleInsideShape(rectangle, shapeInfo.contours)) {
        return false;
    }
    
    if (hasRectangleCollision(rectangle, existingRectangles)) {
        return false;
    }
    
    if (!maintainsMinimumSpacing(rectangle, existingRectangles)) {
        return false;
    }
    
    // Additional validation: ensure rectangle isn't too small to be meaningful
    const minArea = PLACEMENT_CONFIG.minImageSize * PLACEMENT_CONFIG.minImageSize * 0.5;
    if (rectangle.width * rectangle.height < minArea) {
        return false;
    }
    
    return true;
}

// Keep all the existing utility functions unchanged - they work perfectly
// These include:
// - analyzeShapeGeometry()
// - calculateBoundingBox() 
// - sampleInteriorSpace()
// - isPointInsideShape()
// - calculateLocalSpaceAvailability()
// - placeRectanglesIteratively()
// - isRectangleInsideShape()
// - hasRectangleCollision()
// - maintainsMinimumSpacing()
// - optimizePlacement()
// - identifySpaceClusters()
// - estimateShapeArea()

// [Previous utility functions remain exactly the same - no changes needed]

/**
 * Analyze the geometric properties of the body outline shape
 */
function analyzeShapeGeometry(contours) {
    const bounds = calculateBoundingBox(contours);
    const validPoints = sampleInteriorSpace(contours, bounds);
    const spaceMap = calculateLocalSpaceAvailability(validPoints, contours, bounds);
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

function calculateBoundingBox(contours) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
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

function sampleInteriorSpace(contours, bounds) {
    const validPoints = [];
    const step = PLACEMENT_CONFIG.sampleDensity;
    
    for (let y = bounds.y; y < bounds.y + bounds.height; y += step) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x += step) {
            if (isPointInsideShape(x, y, contours)) {
                validPoints.push({x, y, localSpace: 0});
            }
        }
    }
    
    return validPoints;
}

function isPointInsideShape(testX, testY, contours) {
    if (contours.length === 0) return false;
    
    const mainContour = contours.reduce((largest, current) => 
        current.length > largest.length ? current : largest
    );
    
    let intersectionCount = 0;
    
    for (let i = 0; i < mainContour.length; i++) {
        const current = mainContour[i];
        const next = mainContour[(i + 1) % mainContour.length];
        
        if (((current.y > testY) !== (next.y > testY)) &&
            (testX < (next.x - current.x) * (testY - current.y) / (next.y - current.y) + current.x)) {
            intersectionCount++;
        }
    }
    
    return intersectionCount % 2 === 1;
}

function calculateLocalSpaceAvailability(validPoints, contours, bounds) {
    return validPoints.map(point => {
        const testDirections = [
            {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1},
            {dx: 1, dy: 1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}
        ];
        
        let totalSpace = 0;
        
        for (const direction of testDirections) {
            let distance = 0;
            let testX = point.x;
            let testY = point.y;
            
            while (distance < 100 && isPointInsideShape(testX, testY, contours)) {
                distance += 2;
                testX += direction.dx * 2;
                testY += direction.dy * 2;
            }
            
            totalSpace += distance;
        }
        
        const averageSpace = totalSpace / testDirections.length;
        
        return {
            x: point.x,
            y: point.y,
            localSpace: averageSpace
        };
    });
}

function placeRectanglesIteratively(specs, shapeInfo) {
    const placedRectangles = [];
    
    for (let specIndex = 0; specIndex < specs.length; specIndex++) {
        const spec = specs[specIndex];
        let placed = false;
        let attempts = 0;
        let currentWidth = spec.width;
        let currentHeight = spec.height;
        
        while (!placed && attempts < PLACEMENT_CONFIG.maxAttempts) {
            attempts++;
            
            const candidatePoints = shapeInfo.spaceMap.filter(p => 
                p.localSpace >= Math.min(currentWidth, currentHeight) / 2
            );
            
            if (candidatePoints.length === 0) {
                // Maintain aspect ratio while scaling down
                const scaleFactor = 0.9;
                currentWidth *= scaleFactor;
                currentHeight *= scaleFactor;
                
                if (currentWidth < PLACEMENT_CONFIG.minImageSize) {
                    console.log(`⚠️ Could not place rectangle ${specIndex} - no suitable space`);
                    break;
                }
                continue;
            }
            
            const centerPoint = candidatePoints[Math.floor(Math.random() * candidatePoints.length)];
            
            const rectangle = {
                x: centerPoint.x - currentWidth / 2,
                y: centerPoint.y - currentHeight / 2,
                width: currentWidth,
                height: currentHeight,
                centerX: centerPoint.x,
                centerY: centerPoint.y,
                assignedImage: spec.assignedImage, // Carry the image assignment forward
                aspectRatio: spec.aspectRatio
            };
            
            if (isRectanglePlacementValid(rectangle, placedRectangles, shapeInfo)) {
                placedRectangles.push(rectangle);
                placed = true;
                console.log(`✅ Placed image rectangle ${specIndex} at (${Math.round(rectangle.x)}, ${Math.round(rectangle.y)})`);
            }
        }
        
        if (!placed) {
            console.log(`❌ Failed to place rectangle ${specIndex} after ${attempts} attempts`);
        }
    }
    
    return placedRectangles;
}

function isRectangleInsideShape(rectangle, contours) {
    const corners = [
        {x: rectangle.x, y: rectangle.y},
        {x: rectangle.x + rectangle.width, y: rectangle.y},
        {x: rectangle.x, y: rectangle.y + rectangle.height},
        {x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height}
    ];
    
    for (const corner of corners) {
        if (!isPointInsideShape(corner.x, corner.y, contours)) {
            return false;
        }
    }
    
    const edgeMidpoints = [
        {x: rectangle.x + rectangle.width/2, y: rectangle.y},
        {x: rectangle.x + rectangle.width/2, y: rectangle.y + rectangle.height},
        {x: rectangle.x, y: rectangle.y + rectangle.height/2},
        {x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height/2}
    ];
    
    for (const point of edgeMidpoints) {
        if (!isPointInsideShape(point.x, point.y, contours)) {
            return false;
        }
    }
    
    const center = {x: rectangle.x + rectangle.width/2, y: rectangle.y + rectangle.height/2};
    return isPointInsideShape(center.x, center.y, contours);
}

function hasRectangleCollision(rectangle, existingRectangles) {
    for (const existing of existingRectangles) {
        const xOverlap = rectangle.x < existing.x + existing.width && 
                        rectangle.x + rectangle.width > existing.x;
        
        const yOverlap = rectangle.y < existing.y + existing.height && 
                        rectangle.y + rectangle.height > existing.y;
        
        if (xOverlap && yOverlap) {
            return true;
        }
    }
    
    return false;
}

function maintainsMinimumSpacing(rectangle, existingRectangles) {
    const minSpacing = PLACEMENT_CONFIG.minSpacing;
    
    for (const existing of existingRectangles) {
        const xDistance = Math.max(0, 
            Math.max(rectangle.x - (existing.x + existing.width),
                    existing.x - (rectangle.x + rectangle.width)));
        
        const yDistance = Math.max(0,
            Math.max(rectangle.y - (existing.y + existing.height),
                    existing.y - (rectangle.y + rectangle.height)));
        
        const actualDistance = (xDistance === 0 || yDistance === 0) ?
            Math.max(xDistance, yDistance) :
            Math.sqrt(xDistance * xDistance + yDistance * yDistance);
        
        if (actualDistance < minSpacing) {
            return false;
        }
    }
    
    return true;
}

function optimizePlacement(rectangles, shapeInfo) {
    const optimized = rectangles.map(rect => ({...rect}));
    
    const centerOfMass = {
        x: optimized.reduce((sum, rect) => sum + rect.centerX, 0) / optimized.length,
        y: optimized.reduce((sum, rect) => sum + rect.centerY, 0) / optimized.length
    };
    
    for (let i = 0; i < optimized.length; i++) {
        const rect = optimized[i];
        
        const dx = rect.centerX - centerOfMass.x;
        const dy = rect.centerY - centerOfMass.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const adjustmentStrength = 3;
            const adjustX = (dx / distance) * adjustmentStrength;
            const adjustY = (dy / distance) * adjustmentStrength;
            
            const adjustedRect = {
                x: rect.x + adjustX,
                y: rect.y + adjustY,
                width: rect.width,
                height: rect.height,
                centerX: rect.centerX + adjustX,
                centerY: rect.centerY + adjustY,
                assignedImage: rect.assignedImage,
                aspectRatio: rect.aspectRatio
            };
            
            if (isRectanglePlacementValid(adjustedRect, 
                optimized.filter((_, index) => index !== i), shapeInfo)) {
                optimized[i] = adjustedRect;
            }
        }
    }
    
    console.log(`🔧 Placement optimization complete`);
    return optimized;
}

function identifySpaceClusters(spaceMap) {
    return spaceMap.filter(point => point.localSpace > 30)
                  .sort((a, b) => b.localSpace - a.localSpace);
}

function estimateShapeArea(contours, bounds) {
    return bounds.width * bounds.height * 0.6;
}