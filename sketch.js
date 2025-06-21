/*
 * Countdown-Based Interactive Body Installation
 * SIMPLIFIED INTERACTION MODEL
 * 
 * Interaction Flow:
 * 1. Person detected → bright green keypoints appear
 * 2. 3-second countdown with keypoints fading from green to black
 * 3. When countdown completes → capture outline + place images simultaneously
 * 4. Store as single commemorative object for efficient management
 * 5. Keep only most recent interactions, remove older ones
 * 
 * This approach is much simpler and more predictable than growth-based system
 */

// ========== CONFIGURABLE VARIABLES ==========

const COUNTDOWN_DURATION = 3000; // 3 seconds - CHANGE THIS to adjust countdown time
const MAX_COMMEMORATIVE_OBJECTS = 30; // CHANGE THIS to adjust how many to keep
const KEYPOINT_FADE_START_COLOR = [0, 255, 0]; // Bright green
const KEYPOINT_FADE_END_COLOR = [0, 0, 0]; // Black
const KEYPOINT_DOT_SIZE = 16; // Size of countdown dots

// Canvas dimensions
const CANVAS_WIDTH = window.displayWidth - (window.displayWidth/5); // Adjusted for full window width
const CANVAS_HEIGHT = window.displayHeight - (window.displayHeight/5);

// System state - simplified for countdown model
let video;
let bodyPose;
let poses = [];
let availableImages = [];

// Countdown interaction state
let currentCountdown = null; // Single countdown object or null
let commemorativeObjects = []; // Array of completed interaction objects

// Countdown object structure:
// {
//   keypoints: [],           // positions and current colors
//   startTime: number,       // when countdown began
//   isActive: boolean        // whether countdown is running
// }

// Commemorative object structure:
// {
//   outline: [],             // edge contours
//   images: [],              // placed images with positions
//   captureTime: number,     // when this was captured
//   id: number               // unique identifier
// }

let nextObjectId = 1; // For tracking commemorative objects

function preload() {
    bodyPose = ml5.bodyPose("MoveNet", {
        modelType: "MULTIPOSE_LIGHTNING", // "MULTIPOSE_LIGHTNING", "SINGLEPOSE_LIGHTNING", or "SINGLEPOSE_THUNDER".
        enableSmoothing: true,
        minPoseScore: 0.25,
        multiPoseMaxDimension: 256,
        enableTracking: true,
        trackerType: "keypoint", // "keypoint" or "boundingBox"
        trackerConfig: {},
        modelUrl: undefined,
        flipped: true 
    });
}

function setup() {
  
    // let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
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

    aspectRatio = video.width / video.height; // Update aspect ratio based on video size
    let vidWidth = windowWidth;
    let vidHeight = windowWidth / aspectRatio;
    // video.size(CANVAS_WIDTH, CANVAS_HEIGHT);
    video.size(vidWidth, vidHeight);

    video.hide();
    
    loadAvailableImages();
    bodyPose.detectStart(video, gotPoses);
}

function draw() {
    // Clear background each frame to prevent dot accumulation
    background(255);
    
    // Draw all commemorative objects (outlines and images from past interactions)
    drawCommemorativeObjects();
    
    // Handle current countdown interaction
    updateCountdown();
    drawCountdownKeypoints();
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
 * Handle pose detection results from bodyPose
 * This starts or updates the countdown when a person is detected
 */
function gotPoses(results) {
    poses = results;
    
    if (poses.length > 0) {
        // Person detected - start or update countdown
        handlePersonDetected(poses[0]);
    } else {
        // No person - stop countdown if it was running
        handleNoPersonDetected();
    }
}

/**
 * Start countdown when person first detected, or update keypoint positions
 */
function handlePersonDetected(pose) {
    // Extract the keypoints we want to use for the countdown/placement
    const targetKeypoints = extractTargetKeypoints(pose);
    
    if (targetKeypoints.length < 3) {
        // Not enough reliable keypoints - don't start countdown
        return;
    }
    
    if (!currentCountdown || !currentCountdown.isActive) {
        // Start new countdown
        startCountdown(targetKeypoints);
    } else {
        // Update existing countdown with new keypoint positions
        updateCountdownKeypoints(targetKeypoints);
    }
}

/**
 * Stop countdown when person leaves
 */
function handleNoPersonDetected() {
    if (currentCountdown && currentCountdown.isActive) {
        // Person left during countdown - cancel it
        currentCountdown = null;
    }
}

/**
 * Extract target keypoints for countdown and eventual image placement
 */
function extractTargetKeypoints(pose) {
    console.log("Extracting target keypoints from pose:", pose);
    // Names taken from the ml5 bodySegmentation reference https://docs.ml5js.org/#/reference/body-segmentation
    const targetNames = [
        'nose',           // Head
        'left_shoulder', 'right_shoulder',
        // 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist',
        // 'left_hip', 'right_hip'
    ];
    
    const validKeypoints = [];
    
    for (let targetName of targetNames) {
        let keypoint = pose.keypoints.find(kp => 
            // As long as teh keypoint exists and has high confidence (this part reduces jitteryness)
            kp.name === targetName && kp.confidence > 0.4
        );
        
        if (keypoint) {
            validKeypoints.push({
                name: keypoint.name,
                x: keypoint.x,
                y: keypoint.y,
                confidence: keypoint.confidence,
                currentColor: [...KEYPOINT_FADE_START_COLOR] // Start with bright green
            });
        }
    }
    
    return validKeypoints;
}

/**
 * Start a new countdown interaction
 */
function startCountdown(keypoints) {
    currentCountdown = {
        keypoints: keypoints,
        startTime: millis(),
        isActive: true
    };
}

/**
 * Update keypoint positions during countdown (smooth movement)
 */
function updateCountdownKeypoints(newKeypoints) {
    if (!currentCountdown || !currentCountdown.isActive) return;
    
    // Update positions of existing keypoints smoothly
    for (let existingKp of currentCountdown.keypoints) {
        let newKp = newKeypoints.find(kp => kp.name === existingKp.name);
        if (newKp) {
            // Smooth position interpolation
            existingKp.x = lerp(existingKp.x, newKp.x, 0.3);
            existingKp.y = lerp(existingKp.y, newKp.y, 0.3);
            existingKp.confidence = newKp.confidence;
        }
    }
}

/**
 * Update countdown progress and check for completion
 */
function updateCountdown() {
    if (!currentCountdown || !currentCountdown.isActive) return;
    
    const elapsed = millis() - currentCountdown.startTime;
    const progress = elapsed / COUNTDOWN_DURATION; // 0 to 1
    
    if (progress >= 1.0) {
        // Countdown complete - capture this interaction
        captureInteraction();
        currentCountdown = null;
    } else {
        // Update keypoint colors based on countdown progress
        updateKeypointColors(progress);
    }
}

/**
 * Update keypoint colors from green to black based on countdown progress
 */
function updateKeypointColors(progress) {
    for (let keypoint of currentCountdown.keypoints) {
        // Interpolate color from start to end based on progress
        keypoint.currentColor[0] = lerp(KEYPOINT_FADE_START_COLOR[0], KEYPOINT_FADE_END_COLOR[0], progress);
        keypoint.currentColor[1] = lerp(KEYPOINT_FADE_START_COLOR[1], KEYPOINT_FADE_END_COLOR[1], progress);
        keypoint.currentColor[2] = lerp(KEYPOINT_FADE_START_COLOR[2], KEYPOINT_FADE_END_COLOR[2], progress);
    }
}

/**
 * Draw the countdown keypoints with their current colors
 */
function drawCountdownKeypoints() {
    if (!currentCountdown || !currentCountdown.isActive) return;
    
    for (let keypoint of currentCountdown.keypoints) {
        fill(keypoint.currentColor[0], keypoint.currentColor[1], keypoint.currentColor[2]);
        noStroke();
        circle(keypoint.x, keypoint.y, KEYPOINT_DOT_SIZE);
    }
}

/**
 * Capture the current interaction - create outline and place images
 * This is called when countdown completes
 */
function captureInteraction() {
    if (!currentCountdown || currentCountdown.keypoints.length === 0) return;
    
    // Create the commemorative object that will store everything easier for management and to draw in future
    let commemorativeObject = {
        outline: null,          // Will be filled by outline capture
        images: [],             // Will be filled with placed images
        captureTime: millis(),  // for reference
        id: nextObjectId++
    };
    
    // Create images for final keypoint positions with proper aspect ratio preservation
    for (let keypoint of currentCountdown.keypoints) {
        if (availableImages.length > 0) {
            let selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            let baseSize = 100 + Math.random() * 40; // Size variation for the constraining dimension
            
            // Calculate proper dimensions that maintain the original image's aspect ratio
            let originalAspectRatio = selectedImage.width / selectedImage.height;
            let displayWidth, displayHeight;
            
            if (originalAspectRatio > 1) {
                // Image is wider than tall - constrain by width
                displayWidth = baseSize;
                displayHeight = baseSize / originalAspectRatio;
            } else {
                // Image is taller than wide or square - constrain by height  
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
                originalAspectRatio: originalAspectRatio // Store for reference
            });
        }
    }
    
    // Capture outline using body segmentation
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
}

/**
 * Add commemorative object and manage collection size
 */
function addCommemorativeObject(newObject) {
    commemorativeObjects.push(newObject);
    
    // Remove oldest objects if we exceed the maximum
    if (commemorativeObjects.length > MAX_COMMEMORATIVE_OBJECTS) {
        let objectsToRemove = commemorativeObjects.length - MAX_COMMEMORATIVE_OBJECTS;
        commemorativeObjects.splice(0, objectsToRemove);
    }
}

/**
 * Draw all commemorative objects (outlines and images)
 */
function drawCommemorativeObjects() {
    for (let obj of commemorativeObjects) {
        // Draw outline if it exists
        if (obj.outline) {
            stroke(0);
            strokeWeight(2);
            noFill();
            drawEdges(obj.outline, color(0), 2);
        }
        
        // Draw all images for this object
        for (let img of obj.images) {
            if (img.image) {
                image(img.image, img.x, img.y, img.width, img.height);
            }
        }
    }
}

// Development helpers
function keyPressed() {
    if (key === 'r' || key === 'R') {
        // Reset everything
        currentCountdown = null;
        commemorativeObjects = [];
    }
    if (key === 'c' || key === 'C') {
        // Force capture (for testing)
        if (currentCountdown && currentCountdown.isActive) {
            captureInteraction();
            currentCountdown = null;
        }
    }
}