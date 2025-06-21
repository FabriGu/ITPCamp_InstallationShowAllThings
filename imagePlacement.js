/*
 * imagePlacement.js - Growth-Based Keypoint Image System
 * COMPLETELY SIMPLIFIED FOR THE NEW INTERACTION MODEL
 * 
 * This file now focuses entirely on the simple growth-based interaction system.
 * All the complex geometric placement algorithms have been removed since we're
 * now using direct keypoint placement with growth mechanics.
 * 
 * The new approach is beautifully simple:
 * 1. Images appear small on detected keypoints
 * 2. They grow over time as the person stays engaged
 * 3. When they reach full size, the interaction is "captured"
 * 4. No complex geometric calculations needed
 * 
 * This makes the code much easier to understand, modify, and extend.
 */

// Configuration for the growth-based system
const KEYPOINT_GROWTH_CONFIG = {
    // Which body keypoints should have growing images
    targetKeypoints: [
        'nose',           // Head area - most stable keypoint
        'left_shoulder',  'right_shoulder',  // Upper body
        'left_elbow',     'right_elbow',     // Arms  
        'left_wrist',     'right_wrist',     // Hands
        'left_hip',       'right_hip',       // Lower body
        'left_knee',      'right_knee'       // Legs
    ],
    
    // Growth behavior parameters
    minSize: 20,          // Starting size when image first appears
    maxSize: 120,         // Full size when growth is complete
    growthRate: 0.2,      // Size increase per second when person present
    shrinkRate: 2.0,      // Size decrease per second when person absent
    captureThreshold: 0.9, // What percentage of max size triggers capture
    
    // Keypoint confidence and timing
    minConfidence: 0.3,   // Minimum ml5 confidence to trust a keypoint
    gracePeriod: 500,     // Milliseconds to keep growing after person disappears
    minKeypointsForCapture: 3, // How many mature keypoints needed to trigger capture
    
    // Visual variation for natural feel
    positionJitter: 15,   // Random offset from exact keypoint position
    sizeVariation: 20     // Random variation in final size
};

/**
 * Extract target keypoints from a detected pose
 * 
 * This function takes a raw pose from ml5.bodyPose and returns only the
 * keypoints we want to use for image placement. This makes it easy to
 * add or remove keypoints by simply modifying the targetKeypoints array.
 * 
 * Think of this like filtering a guest list - we have all the detected
 * keypoints, but we only want to work with the ones that make sense
 * for our interaction design.
 * 
 * @param {Object} pose - A single pose object from ml5.bodyPose
 * @returns {Array} Filtered array of keypoints suitable for image placement
 */
function extractTargetKeypoints(pose) {
    const validKeypoints = [];
    
    // Check each keypoint in the pose against our target list
    for (let keypoint of pose.keypoints) {
        // Only include keypoints that are in our target list and have good confidence
        if (KEYPOINT_GROWTH_CONFIG.targetKeypoints.includes(keypoint.name) && 
            keypoint.confidence > KEYPOINT_GROWTH_CONFIG.minConfidence) {
            
            // Add some natural variation to the position for organic feel
            const jitter = KEYPOINT_GROWTH_CONFIG.positionJitter;
            const offsetX = (Math.random() - 0.5) * jitter;
            const offsetY = (Math.random() - 0.5) * jitter;
            
            validKeypoints.push({
                name: keypoint.name,
                x: keypoint.x + offsetX,
                y: keypoint.y + offsetY,
                confidence: keypoint.confidence,
                originalX: keypoint.x,  // Keep original for reference
                originalY: keypoint.y
            });
        }
    }
    
    return validKeypoints;
}

/**
 * Create a new growing image object for a keypoint
 * 
 * This function initializes all the properties needed to track an image
 * as it grows on a keypoint. Each growing image is like a living entity
 * that knows its current state and how to change over time.
 * 
 * Think of this like planting a seed - we're setting up everything the
 * seed needs to grow into a full-sized plant over time.
 * 
 * @param {Object} keypoint - The keypoint where this image will grow
 * @param {Array} availableImages - Pool of images to choose from
 * @returns {Object} A complete growing image object
 */
function createGrowingImageAtKeypoint(keypoint, availableImages) {
    // Add some variation to the final target size for visual interest
    const sizeVariation = KEYPOINT_GROWTH_CONFIG.sizeVariation;
    const baseSize = KEYPOINT_GROWTH_CONFIG.maxSize;
    const targetSize = baseSize + (Math.random() - 0.5) * sizeVariation;
    
    // Select a random image from the available pool
    const selectedImage = availableImages.length > 0 ? 
        availableImages[Math.floor(Math.random() * availableImages.length)] : null;
    
    return {
        // Identity and position
        keypointName: keypoint.name,
        x: keypoint.x,
        y: keypoint.y,
        originalX: keypoint.originalX,
        originalY: keypoint.originalY,
        
        // Growth state
        currentSize: KEYPOINT_GROWTH_CONFIG.minSize,
        targetSize: targetSize,
        isGrowing: true,
        hasTriggeredCapture: false,
        
        // Visual properties
        image: selectedImage,
        aspectRatio: selectedImage ? selectedImage.width / selectedImage.height : 1,
        opacity: 1.0,
        
        // Timing and tracking
        creationTime: millis(),
        lastUpdateTime: millis(),
        lastSeenTime: millis(),
        confidence: keypoint.confidence
    };
}

/**
 * Update the growth state of an existing growing image
 * 
 * This function handles the core growth mechanics - making images bigger
 * when the person is present and smaller when they're absent. It's like
 * tending a garden, where each plant grows or shrinks based on conditions.
 * 
 * @param {Object} growingImage - The image object to update
 * @param {boolean} isPersonPresent - Whether the person is currently detected
 * @param {number} deltaTime - Time since last update in milliseconds
 * @returns {Object} Updated growing image object
 */
function updateGrowingImage(growingImage, isPersonPresent, deltaTime) {
    const deltaSeconds = deltaTime / 1000; // Convert to seconds for easier math
    
    if (isPersonPresent) {
        // Person is present - grow the image toward its target size
        const growthAmount = KEYPOINT_GROWTH_CONFIG.growthRate * deltaSeconds;
        growingImage.currentSize += growthAmount;
        
        // Cap at target size
        growingImage.currentSize = Math.min(growingImage.currentSize, growingImage.targetSize);
        
        // Update timing
        growingImage.lastSeenTime = millis();
        growingImage.isGrowing = growingImage.currentSize < growingImage.targetSize;
        
    } else {
        // Person not present - shrink the image
        const shrinkAmount = KEYPOINT_GROWTH_CONFIG.shrinkRate * deltaSeconds;
        growingImage.currentSize -= shrinkAmount;
        
        // Don't let it go below zero
        growingImage.currentSize = Math.max(growingImage.currentSize, 0);
        growingImage.isGrowing = false;
    }
    
    growingImage.lastUpdateTime = millis();
    return growingImage;
}

/**
 * Check if a growing image has reached the capture threshold
 * 
 * This function determines when an image has grown large enough to trigger
 * the capture process. It's like checking if a fruit is ripe enough to pick.
 * 
 * @param {Object} growingImage - The image to check
 * @returns {boolean} True if the image is ready for capture
 */
function isReadyForCapture(growingImage) {
    const growthProgress = growingImage.currentSize / growingImage.targetSize;
    return growthProgress >= KEYPOINT_GROWTH_CONFIG.captureThreshold && 
           !growingImage.hasTriggeredCapture;
}

/**
 * Check if we have enough mature images to trigger a full capture
 * 
 * This function looks at all the growing images and determines if enough
 * of them have matured to warrant capturing the entire interaction.
 * 
 * Think of this like waiting for enough flowers in a garden to bloom
 * before taking a photograph of the whole garden.
 * 
 * @param {Array} growingImages - Array of all current growing images
 * @returns {boolean} True if we should trigger a capture moment
 */
function shouldTriggerCapture(growingImages) {
    const readyImages = growingImages.filter(isReadyForCapture);
    return readyImages.length >= KEYPOINT_GROWTH_CONFIG.minKeypointsForCapture;
}

/**
 * Convert growing images to frozen commemorative images
 * 
 * When we capture an interaction, the growing images become frozen
 * commemorative elements that remain permanently on the canvas.
 * This function handles that transformation.
 * 
 * Think of this like pressing flowers - we're preserving the current
 * state of the growing images so they become lasting memories.
 * 
 * @param {Array} growingImages - Current growing images to freeze
 * @returns {Array} Frozen commemorative image objects
 */
function freezeImagesForCommemoration(growingImages) {
    return growingImages.map(growingImage => {
        // Calculate final display dimensions maintaining aspect ratio
        let displayWidth = growingImage.currentSize * growingImage.aspectRatio;
        let displayHeight = growingImage.currentSize;
        
        return {
            // Position (centered on keypoint)
            x: growingImage.x - displayWidth / 2,
            y: growingImage.y - displayHeight / 2,
            width: displayWidth,
            height: displayHeight,
            
            // Visual properties
            image: growingImage.image,
            opacity: 1.0,
            
            // Metadata for tracking
            type: 'frozen_commemorative_image',
            originalKeypointName: growingImage.keypointName,
            captureTime: millis(),
            finalSize: growingImage.currentSize
        };
    });
}

/**
 * Draw a single growing image on the canvas
 * 
 * This function handles the visual rendering of growing images, including
 * maintaining proper aspect ratios and centering on keypoints.
 * 
 * @param {Object} growingImage - The growing image to draw
 */
function drawGrowingImage(growingImage) {
    if (!growingImage.image || growingImage.currentSize <= 0) return;
    
    // Calculate display dimensions maintaining aspect ratio
    let displayWidth = growingImage.currentSize * growingImage.aspectRatio;
    let displayHeight = growingImage.currentSize;
    
    // Draw image centered on keypoint position
    image(growingImage.image,
          growingImage.x - displayWidth / 2,
          growingImage.y - displayHeight / 2,
          displayWidth,
          displayHeight);
}

/**
 * Draw a frozen commemorative image
 * 
 * This function draws images that have been captured and frozen in place
 * as permanent commemorative elements.
 * 
 * @param {Object} frozenImage - The frozen image to draw
 */
function drawFrozenImage(frozenImage) {
    if (!frozenImage.image) return;
    
    // Apply opacity for fading effects if needed
    if (frozenImage.opacity < 1.0) {
        tint(255, frozenImage.opacity * 255);
    }
    
    // Draw the frozen image at its captured position and size
    image(frozenImage.image,
          frozenImage.x,
          frozenImage.y,
          frozenImage.width,
          frozenImage.height);
    
    // Reset tint
    if (frozenImage.opacity < 1.0) {
        noTint();
    }
}

/**
 * Get configuration information for debugging and tuning
 * 
 * This utility function returns the current configuration, which is helpful
 * for debugging and allowing easy adjustments to the growth behavior.
 * 
 * @returns {Object} Current configuration settings
 */
function getGrowthConfig() {
    return {
        ...KEYPOINT_GROWTH_CONFIG,
        totalTargetKeypoints: KEYPOINT_GROWTH_CONFIG.targetKeypoints.length,
        systemType: 'growth_based_keypoint_placement'
    };
}

/**
 * Update configuration values dynamically
 * 
 * This function allows you to adjust the growth behavior without restarting
 * the application, which is useful for fine-tuning during development.
 * 
 * @param {Object} newConfig - Configuration values to update
 */
function updateGrowthConfig(newConfig) {
    Object.assign(KEYPOINT_GROWTH_CONFIG, newConfig);
    // console.log("🔧 Growth configuration updated:", newConfig);
}