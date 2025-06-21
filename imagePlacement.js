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
        // 'left_elbow',     'right_elbow',     // Arms  
        'left_wrist',     'right_wrist',     // Hands
        // 'left_hip',       'right_hip',       // Lower body
        // 'left_knee',      'right_knee'       // Legs
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
