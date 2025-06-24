/*
 * Multi-Person Countdown-Based Interactive Body Installation
 * EXPANDED FOR MULTIPLE SIMULTANEOUS USERS
 * 
 * Interaction Flow (Now Multi-Person):
 * 1. Each person detected → gets unique colored keypoints
 * 2. Shared 3-second countdown with individual color-coded keypoints fading
 * 3. When countdown completes → capture outlines + place images for all active people
 * 4. Store as single commemorative object containing all interactions
 * 5. Efficient person tracking using ml5's built-in pose IDs
 * 
 * Key Multi-Person Features:
 * - Each person gets a unique color (cycling through predefined palette)
 * - Shared countdown timer for simplicity and synchronized captures
 * - Individual keypoint tracking per person
 * - Efficient memory management by reusing colors when people leave
 */

// ========== CONFIGURABLE VARIABLES ==========

const COUNTDOWN_DURATION = 3000; // 3 seconds - CHANGE THIS to adjust countdown time
const MAX_COMMEMORATIVE_OBJECTS = 10; // CHANGE THIS to adjust how many to keep
const KEYPOINT_DOT_SIZE = 16; // Size of countdown dots

// Multi-person color palette - each person gets assigned one of these colors
const PERSON_COLORS = [
    [0, 255, 0],     // Bright green (person 1)
    [255, 100, 0],   // Orange (person 2) 
    [0, 100, 255],   // Blue (person 3)
    [255, 0, 255],   // Magenta (person 4)
    [255, 255, 0],   // Yellow (person 5)
    [0, 255, 255],   // Cyan (person 6)
    [255, 0, 100],   // Pink (person 7)
    [100, 255, 0]    // Lime (person 8)
];

// Fade end color (all colors fade to black)
const KEYPOINT_FADE_END_COLOR = [0, 0, 0];

// Canvas dimensions
const CANVAS_WIDTH = window.displayWidth;
const CANVAS_HEIGHT = window.displayHeight;

// System state - expanded for multi-person
let video;
let bodyPose;
let poses = [];
let availableImages = [];

// Multi-person countdown state
let activeCountdowns = new Map(); // Map of personId -> countdown object
let sharedCountdownActive = false; // Whether any countdown is running
let sharedCountdownStartTime = null; // When the current shared countdown began
let nextColorIndex = 0; // For cycling through colors efficiently

// Commemorative objects (unchanged structure)
let commemorativeObjects = [];
let nextObjectId = 1;

// Person tracking data structure:
// Map entry: personId -> {
//   keypoints: [],           // current keypoints with colors
//   assignedColor: [],       // RGB color assigned to this person
//   colorIndex: number,      // index in PERSON_COLORS array
//   lastSeenTime: number     // for cleanup of disappeared people
// }

function preload() {
    bodyPose = ml5.bodyPose("MoveNet", {
        modelType: "MULTIPOSE_LIGHTNING", // Important: MULTIPOSE for multiple people
        enableSmoothing: true,
        minPoseScore: 0.25,
        multiPoseMaxDimension: 256,
        enableTracking: true,         // Essential for person identification
        trackerType: "keypoint",      // "keypoint" tracking works well for this
        trackerConfig: {},
        modelUrl: undefined,
        flipped: true 
    });
}

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    document.getElementById('canvas-container').style.display = 'flex';
    document.getElementById('canvas-container').style.justifyContent = 'center';
    document.getElementById('canvas-container').style.alignItems = 'center';
    document.getElementById('canvas-container').style.width = '100%';
    document.getElementById('canvas-container').style.height = '100%';
    document.getElementById('canvas-container').style.position = 'absolute';
    document.getElementById('canvas-container').style.top = '0';
    document.getElementById('canvas-container').style.left = '0';
    
    video = createCapture(VIDEO);
    aspectRatio = video.width / video.height;
    let vidWidth = windowWidth;
    let vidHeight = windowWidth / aspectRatio;
    video.size(vidWidth, vidHeight);
    video.hide();
    
    loadAvailableImages();
    bodyPose.detectStart(video, gotPoses);
}

function draw() {
    // Clear background each frame
    background(0);
    
    // Draw all commemorative objects (outlines and images from past interactions)
    drawCommemorativeObjects();
    
    // Handle multi-person countdown system
    updateSharedCountdown();
    drawAllCountdownKeypoints();
    
    // Clean up inactive people (remove those who haven't been seen recently)
    cleanupInactivePeople();
}

function loadAvailableImages() {
    const imageFilenames = [
        '5W3A3139.JPG', '5W3A3140.JPG', '5W3A3141.JPG', '5W3A3142.JPG', 
        '5W3A3143.JPG', '5W3A3144.JPG', '5W3A3145.JPG', '5W3A3146.JPG',
        '5W3A3147.JPG', '5W3A3148.JPG', '5W3A3149.JPG', '5W3A3150.JPG',
        '5W3A3151.JPG', '5W3A3152.JPG', '5W3A3153.JPG', '5W3A3154.JPG',
        '5W3A3155.JPG', '5W3A3156.JPG'
    ];

    for (let filename of imageFilenames) {
        loadImage(`images/${filename}`, 
            (img) => availableImages.push(img)
        );
    }
}

/**
 * Handle pose detection results - now processes multiple people
 * This is the main entry point for multi-person detection
 */
function gotPoses(results) {
    poses = results;
    
    // Process each detected person individually
    let currentlyDetectedPeople = new Set();
    
    for (let pose of poses) {
        if (pose.id !== undefined) { // ml5 provides unique IDs for tracked poses
            currentlyDetectedPeople.add(pose.id);
            handlePersonDetected(pose.id, pose);
        }
    }
    
    // Check if we should start or continue the shared countdown
    manageSharedCountdown(currentlyDetectedPeople.size > 0);
}

/**
 * Process an individual person's pose data
 * Each person gets their own color and keypoint tracking
 */
function handlePersonDetected(personId, pose) {
    // Extract valid keypoints for this person
    const targetKeypoints = extractTargetKeypoints(pose);
    
    if (targetKeypoints.length < 3) {
        // Not enough reliable keypoints for this person
        return;
    }
    
    // Get or create person tracking data
    if (!activeCountdowns.has(personId)) {
        // New person detected - assign them a color and initialize tracking
        initializeNewPerson(personId, targetKeypoints);
    } else {
        // Existing person - update their keypoint positions
        updatePersonKeypoints(personId, targetKeypoints);
    }
    
    // Mark this person as currently active
    activeCountdowns.get(personId).lastSeenTime = millis();
}

/**
 * Initialize tracking for a newly detected person
 * Assigns them a unique color and sets up their countdown state
 */
function initializeNewPerson(personId, keypoints) {
    // Assign color from our palette (cycling through available colors)
    const assignedColor = [...PERSON_COLORS[nextColorIndex]];
    nextColorIndex = (nextColorIndex + 1) % PERSON_COLORS.length;
    
    // Add color information to each keypoint
    const coloredKeypoints = keypoints.map(kp => ({
        ...kp,
        currentColor: [...assignedColor], // Start with their assigned color
        originalColor: [...assignedColor] // Remember original for fading calculations
    }));
    
    // Create person tracking entry
    activeCountdowns.set(personId, {
        keypoints: coloredKeypoints,
        assignedColor: assignedColor,
        colorIndex: nextColorIndex - 1, // The index we just used
        lastSeenTime: millis()
    });
}

/**
 * Update keypoint positions for an existing person
 * Smoothly interpolates positions to reduce jitter
 */
function updatePersonKeypoints(personId, newKeypoints) {
    const personData = activeCountdowns.get(personId);
    if (!personData) return;
    
    // Update positions of existing keypoints with smooth interpolation
    for (let existingKp of personData.keypoints) {
        let newKp = newKeypoints.find(kp => kp.name === existingKp.name);
        if (newKp) {
            // Smooth position interpolation to reduce jitter
            existingKp.x = lerp(existingKp.x, newKp.x, 0.3);
            existingKp.y = lerp(existingKp.y, newKp.y, 0.3);
            existingKp.confidence = newKp.confidence;
        }
    }
}

/**
 * Manage the shared countdown timer
 * Simplified approach: one timer for all people
 */
function manageSharedCountdown(peoplePresent) {
    if (peoplePresent && !sharedCountdownActive) {
        // Start new shared countdown
        sharedCountdownActive = true;
        sharedCountdownStartTime = millis();
    } else if (!peoplePresent && sharedCountdownActive) {
        // Stop countdown if no people present
        sharedCountdownActive = false;
        sharedCountdownStartTime = null;
    }
}

/**
 * Update the shared countdown and trigger capture when complete
 */
function updateSharedCountdown() {
    if (!sharedCountdownActive || !sharedCountdownStartTime) return;
    
    const elapsed = millis() - sharedCountdownStartTime;
    const progress = elapsed / COUNTDOWN_DURATION; // 0 to 1
    
    if (progress >= 1.0) {
        // Countdown complete - capture all active interactions
        captureAllActiveInteractions();
        
        // Reset countdown state
        sharedCountdownActive = false;
        sharedCountdownStartTime = null;
    } else {
        // Update colors for all active people based on countdown progress
        updateAllKeypointColors(progress);
    }
}

/**
 * Update keypoint colors for all people based on countdown progress
 * Each person's color fades from their assigned color to black
 */
function updateAllKeypointColors(progress) {
    for (let [personId, personData] of activeCountdowns) {
        for (let keypoint of personData.keypoints) {
            // Fade from original assigned color to black
            keypoint.currentColor[0] = lerp(keypoint.originalColor[0], KEYPOINT_FADE_END_COLOR[0], progress);
            keypoint.currentColor[1] = lerp(keypoint.originalColor[1], KEYPOINT_FADE_END_COLOR[1], progress);
            keypoint.currentColor[2] = lerp(keypoint.originalColor[2], KEYPOINT_FADE_END_COLOR[2], progress);
        }
    }
}

/**
 * Draw countdown keypoints for all active people
 * Each person's keypoints appear in their assigned color
 */
function drawAllCountdownKeypoints() {
    if (!sharedCountdownActive) return;
    
    for (let [personId, personData] of activeCountdowns) {
        for (let keypoint of personData.keypoints) {
            fill(keypoint.currentColor[0], keypoint.currentColor[1], keypoint.currentColor[2]);
            noStroke();
            circle(keypoint.x, keypoint.y, KEYPOINT_DOT_SIZE);
        }
    }
}

/**
 * Extract target keypoints - same logic as before but cleaned up
 */
function extractTargetKeypoints(pose) {
    const targetNames = [
        'nose',           // Head
        'left_shoulder', 'right_shoulder',
        'left_wrist', 'right_wrist'
    ];
    
    const validKeypoints = [];
    
    for (let targetName of targetNames) {
        let keypoint = pose.keypoints.find(kp => 
            kp.name === targetName && kp.confidence > 0.4
        );
        
        if (keypoint) {
            validKeypoints.push({
                name: keypoint.name,
                x: keypoint.x,
                y: keypoint.y,
                confidence: keypoint.confidence
            });
        }
    }
    
    return validKeypoints;
}

/**
 * Capture interactions for all currently active people
 * Creates one commemorative object containing all people's interactions
 */
function captureAllActiveInteractions() {
    if (activeCountdowns.size === 0) return;
    
    // Create commemorative object for this capture session
    let commemorativeObject = {
        outline: null,          // Single outline (body segmentation limitation)
        images: [],             // Images for all people
        captureTime: millis(),
        id: nextObjectId++,
        peopleCount: activeCountdowns.size // Record how many people were involved
    };
    
    // Place images for each active person
    for (let [personId, personData] of activeCountdowns) {
        placeImagesForPerson(personData, commemorativeObject);
    }
    
    // Capture outline (body segmentation may only work for one person, but we'll try)
    // For multi-person, this will capture whatever the body segmentation can detect
    initializeBodySegmentationForCapture(video, (segmentationResult) => {
        if (segmentationResult && segmentationResult.mask) {
            segmentationResult.mask.loadPixels();
            let outline = extractEdgesFromMask(segmentationResult.mask);
            
            if (outline) {
                commemorativeObject.outline = outline;
            }
            
            // Clean up mask
            segmentationResult.mask.remove();
        }
        
        // Add completed object to collection
        addCommemorativeObject(commemorativeObject);
    });
    
    // Clear all active countdowns after capture
    activeCountdowns.clear();
    nextColorIndex = 0; // Reset color assignment
}

/**
 * Place images for an individual person based on their keypoints
 * Same logic as before but adapted for multi-person structure
 */
function placeImagesForPerson(personData, commemorativeObject) {
    const keypoints = personData.keypoints;
    
    // Handle center image between shoulders
    let leftShoulder = keypoints.find(kp => kp.name === 'left_shoulder');
    let rightShoulder = keypoints.find(kp => kp.name === 'right_shoulder');

    if (leftShoulder && rightShoulder && availableImages.length > 0) {
        let centerX = (leftShoulder.x + rightShoulder.x) / 2;
        let centerY = (leftShoulder.y + rightShoulder.y) / 2;
        
        let selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
        let baseSize = (100 + Math.random() * 40) * 2;
        
        let originalAspectRatio = selectedImage.width / selectedImage.height;
        let displayWidth, displayHeight;
        
        if (originalAspectRatio > 1) {
            displayWidth = baseSize;
            displayHeight = baseSize / originalAspectRatio;
        } else {
            displayHeight = baseSize;
            displayWidth = baseSize * originalAspectRatio;
        }
        
        commemorativeObject.images.push({
            image: selectedImage,
            x: centerX - displayWidth/2,
            y: centerY - displayHeight/2,
            width: displayWidth,
            height: displayHeight,
            keypointName: 'center_shoulders',
            originalAspectRatio: originalAspectRatio,
            personColor: personData.assignedColor // Store the person's color for reference
        });
    }
    
    // Place images on other keypoints
    for (let keypoint of keypoints) {
        if (keypoint.name === 'left_shoulder' || keypoint.name === 'right_shoulder') {
            continue; // Skip shoulders since we handled them above
        }

        if (availableImages.length > 0) {
            let selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            let baseSize = 100 + Math.random() * 40;
            
            let originalAspectRatio = selectedImage.width / selectedImage.height;
            let displayWidth, displayHeight;
            
            if (originalAspectRatio > 1) {
                displayWidth = baseSize;
                displayHeight = baseSize / originalAspectRatio;
            } else {
                displayHeight = baseSize;
                displayWidth = baseSize * originalAspectRatio;
            }
            
            commemorativeObject.images.push({
                image: selectedImage,
                x: keypoint.x - displayWidth/2,
                y: keypoint.y - displayHeight/2,
                width: displayWidth,
                height: displayHeight,
                keypointName: keypoint.name,
                originalAspectRatio: originalAspectRatio,
                personColor: personData.assignedColor // Store the person's color
            });
        }
    }
}

/**
 * Clean up people who haven't been seen recently
 * Prevents memory buildup from tracking people who left
 */
function cleanupInactivePeople() {
    const currentTime = millis();
    const timeoutDuration = 1000; // Remove people not seen for 1 second
    
    for (let [personId, personData] of activeCountdowns) {
        if (currentTime - personData.lastSeenTime > timeoutDuration) {
            activeCountdowns.delete(personId);
        }
    }
    
    // If no people remain, reset color assignment
    if (activeCountdowns.size === 0) {
        nextColorIndex = 0;
    }
}

/**
 * Add commemorative object and manage collection size
 * Same as before - no changes needed
 */
function addCommemorativeObject(newObject) {
    commemorativeObjects.push(newObject);
    
    if (commemorativeObjects.length > MAX_COMMEMORATIVE_OBJECTS) {
        let objectsToRemove = commemorativeObjects.length - MAX_COMMEMORATIVE_OBJECTS;
        commemorativeObjects.splice(0, objectsToRemove);
    }
}

/**
 * Draw all commemorative objects (outlines and images)
 * Same as before - no changes needed
 */
function drawCommemorativeObjects() {
    for (let objI in commemorativeObjects) {
        let obj = commemorativeObjects[objI];
        
        if (obj.outline) {
            // let colorValue = map(objI, MAX_COMMEMORATIVE_OBJECTS - 1, 0, 10, 255);
            let colorValue = map(objI, MAX_COMMEMORATIVE_OBJECTS - 1, 0, 255, 10);

            stroke(colorValue);
            let strokeWeightValue = map(objI, MAX_COMMEMORATIVE_OBJECTS - 1, 0, 2, 0.1);
            strokeWeight(strokeWeightValue);
            noFill();
            drawEdges(obj.outline, color(colorValue), strokeWeightValue);
        }
        
        for (let img of obj.images) {
            if (img.image) {
                image(img.image, img.x, img.y, img.width, img.height);
            }
        }
    }
}

// Development helpers - enhanced for multi-person debugging
function keyPressed() {
    if (key === 'r' || key === 'R') {
        // Reset everything
        activeCountdowns.clear();
        commemorativeObjects = [];
        sharedCountdownActive = false;
        sharedCountdownStartTime = null;
        nextColorIndex = 0;
    }
    if (key === 'c' || key === 'C') {
        // Force capture (for testing)
        if (sharedCountdownActive) {
            captureAllActiveInteractions();
            sharedCountdownActive = false;
            sharedCountdownStartTime = null;
        }
    }
    if (key === 'i' || key === 'I') {
        // Debug info
        console.log(`Active people: ${activeCountdowns.size}`);
        console.log(`Countdown active: ${sharedCountdownActive}`);
        console.log(`Commemorative objects: ${commemorativeObjects.length}`);
    }
}