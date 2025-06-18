/*
 * Main sketch.js - Orchestrates the body outline image placement experience
 * 
 * This file coordinates all the different components:
 * - Camera setup and video capture
 * - Body segmentation processing
 * - Timing and state management
 * - Visual effects (pulsing outline)
 * - Image placement coordination
 */

// Canvas dimensions optimized for webcam input
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// Timing constants for the experience flow
const DETECTION_STABILITY_TIME = 2000; // 2 seconds to detect stable person
const PULSE_DURATION = 3000; // 3 seconds of pulsing before placement
const MIN_PERSON_AREA = 5000; // Minimum pixel area to consider a valid person detection

// Application state management
let appState = {
    current: 'WAITING', // WAITING, DETECTING, PULSING, PLACING, COMPLETE
    personDetectedTime: 0,
    pulseStartTime: 0,
    lastPersonArea: 0,
    consecutiveDetections: 0
};

// Visual elements
let video;
let currentEdges = null;
let placedImages = [];
let debugMode = false;

// Pulse effect variables
let pulseIntensity = 0;
let pulseSpeed = 1;

function setup() {
    // Create canvas and position it in the container
    let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('canvas-container');
    
    // Initialize video capture with optimized settings
    video = createCapture(VIDEO);
    video.size(CANVAS_WIDTH, CANVAS_HEIGHT);
    video.hide(); // Hide the default video element
    
    // Initialize body segmentation module
    initializeBodySegmentation(video, onSegmentationResult);
    
    console.log("Application initialized - waiting for person to appear");
}

function draw() {
    background(255);
    
    // Always show the video feed as background
    image(video, 0, 0);
    
    // Handle different application states
    switch(appState.current) {
        case 'WAITING':
            drawWaitingState();
            break;
            
        case 'DETECTING':
            drawDetectingState();
            break;
            
        case 'PULSING':
            drawPulsingState();
            break;
            
        case 'PLACING':
            drawPlacingState();
            break;
            
        case 'COMPLETE':
            drawCompleteState();
            break;
    }
    
    // Show debug information if enabled
    if (debugMode) {
        drawDebugInfo();
    }
}

function drawWaitingState() {
    // Show subtle overlay to indicate waiting
    fill(255, 255, 255, 30);
    rect(0, 0, width, height);
    
    // Show instructions
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Step into view and hold still...", width/2, height/2);
}

function drawDetectingState() {
    // Draw the detected edges
    if (currentEdges) {
        drawEdges(currentEdges, color(0), 3);
    }
    
    // Show countdown progress
    let progress = (millis() - appState.personDetectedTime) / DETECTION_STABILITY_TIME;
    progress = constrain(progress, 0, 1);
    
    // Progress bar
    let barWidth = 200;
    let barHeight = 20;
    let barX = (width - barWidth) / 2;
    let barY = height - 60;
    
    fill(255);
    stroke(0);
    rect(barX, barY, barWidth, barHeight);
    
    fill(100, 200, 100);
    noStroke();
    rect(barX, barY, barWidth * progress, barHeight);
    
    // Instructions
    fill(0);
    textAlign(CENTER);
    textSize(16);
    text("Hold still... " + Math.ceil((1 - progress) * (DETECTION_STABILITY_TIME / 1000)) + "s", width/2, barY - 10);
}

function drawPulsingState() {
    // Calculate pulse parameters
    let elapsed = millis() - appState.pulseStartTime;
    let progress = elapsed / PULSE_DURATION;
    
    // Exponential increase in pulse speed for dramatic effect
    pulseSpeed = 1 + progress * progress * 10;
    pulseIntensity = sin(millis() * 0.01 * pulseSpeed) * 0.5 + 0.5;
    
    // Pulse the edge color from black to white
    let pulseColor = lerpColor(color(0), color(255), pulseIntensity);
    
    if (currentEdges) {
        // Make the line thickness pulse too for extra drama
        let lineThickness = 2 + pulseIntensity * 4;
        drawEdges(currentEdges, pulseColor, lineThickness);
    }
    
    // Show get ready message
    fill(255, 100, 100);
    textAlign(CENTER);
    textSize(20);
    text("Get ready...", width/2, 50);
    
    // Check if pulsing is complete
    if (elapsed >= PULSE_DURATION) {
        transitionToPlacement();
    }
}

function drawPlacingState() {
    // Show white background (outline has "disappeared")
    background(255);
    
    // Show placement in progress
    fill(0);
    textAlign(CENTER);
    textSize(18);
    text("Placing images...", width/2, 50);
}

function drawCompleteState() {
    // Show only the placed images on white background
    background(255);
    
    // Draw all placed images/squares
    for (let img of placedImages) {
        drawPlacedImage(img);
    }
    
    // Show completion message
    fill(100);
    textAlign(CENTER);
    textSize(16);
    text("Complete! Press Reset to try again.", width/2, height - 30);
}

function drawDebugInfo() {
    // Debug overlay
    fill(0, 0, 0, 150);
    rect(0, 0, 200, 120);
    
    fill(255);
    textAlign(LEFT);
    textSize(12);
    text(`State: ${appState.current}`, 10, 20);
    text(`Person Area: ${appState.lastPersonArea}`, 10, 35);
    text(`Detections: ${appState.consecutiveDetections}`, 10, 50);
    text(`Images Placed: ${placedImages.length}`, 10, 65);
    
    if (appState.current === 'DETECTING') {
        let remaining = (DETECTION_STABILITY_TIME - (millis() - appState.personDetectedTime)) / 1000;
        text(`Countdown: ${remaining.toFixed(1)}s`, 10, 80);
    }
    
    if (appState.current === 'PULSING') {
        let remaining = (PULSE_DURATION - (millis() - appState.pulseStartTime)) / 1000;
        text(`Pulse: ${remaining.toFixed(1)}s`, 10, 80);
    }
}

// Callback function for body segmentation results
function onSegmentationResult(segmentation) {
    if (!segmentation || !segmentation.mask) {
        handleNoPersonDetected();
        return;
    }
    
    // Extract edges from the segmentation mask
    currentEdges = extractEdgesFromMask(segmentation.mask);
    
    // Calculate person area for stability checking
    let personArea = calculatePersonArea(segmentation.mask);
    appState.lastPersonArea = personArea;
    
    // Check if we have a valid person detection
    if (personArea > MIN_PERSON_AREA) {
        handlePersonDetected(personArea);
    } else {
        handleNoPersonDetected();
    }
}

function handlePersonDetected(personArea) {
    // Check for stability (similar area across frames)
    let isStable = appState.consecutiveDetections > 10 && 
                   abs(personArea - appState.lastPersonArea) < personArea * 0.1;
    
    if (appState.current === 'WAITING') {
        if (isStable) {
            // Start detection phase
            appState.current = 'DETECTING';
            appState.personDetectedTime = millis();
            updateStatus("Person detected! Hold still...", 'detecting');
            console.log("Person detected - starting stability timer");
        }
        appState.consecutiveDetections++;
    } 
    else if (appState.current === 'DETECTING') {
        // Check if we've been stable long enough
        if (millis() - appState.personDetectedTime >= DETECTION_STABILITY_TIME) {
            startPulsingPhase();
        } else if (!isStable) {
            // Reset if person moved too much
            appState.current = 'WAITING';
            appState.consecutiveDetections = 0;
            updateStatus("Person moved - please hold still", 'waiting');
        }
    }
}

function handleNoPersonDetected() {
    if (appState.current === 'WAITING' || appState.current === 'DETECTING') {
        appState.current = 'WAITING';
        appState.consecutiveDetections = 0;
        updateStatus("Waiting for person to appear...", 'waiting');
    }
    currentEdges = null;
}

function startPulsingPhase() {
    appState.current = 'PULSING';
    appState.pulseStartTime = millis();
    updateStatus("Get ready for the magic...", 'pulsing');
    console.log("Starting pulsing phase");
}

function transitionToPlacement() {
    appState.current = 'PLACING';
    updateStatus("Placing images...", 'placing');
    console.log("Starting image placement");
    
    // Use the current edges to place images
    if (currentEdges) {
        placedImages = placeImagesInBodyOutline(currentEdges, 7); // Place 7 images
        
        // Transition to complete state after a brief delay
        setTimeout(() => {
            appState.current = 'COMPLETE';
            updateStatus("Complete! Your digital silhouette is ready.", 'complete');
            console.log(`Placement complete - ${placedImages.length} images placed`);
        }, 500);
    }
}

function calculatePersonArea(mask) {
    // Efficiently calculate the area of the person in the mask
    mask.loadPixels();
    let area = 0;
    
    // Sample every 4th pixel for performance (we only need an estimate)
    for (let i = 0; i < mask.pixels.length; i += 16) { // RGBA, so skip by 16 to get every 4th pixel
        if (mask.pixels[i + 3] > 128) { // Check alpha channel
            area += 4; // Account for the sampling
        }
    }
    
    return area;
}

function drawPlacedImage(imageData) {
    // For now, draw black squares as placeholders
    // In a real implementation, this would draw actual images
    fill(0);
    noStroke();
    rect(imageData.x, imageData.y, imageData.width, imageData.height);
    
    // Add a subtle border
    stroke(255);
    strokeWeight(1);
    noFill();
    rect(imageData.x, imageData.y, imageData.width, imageData.height);
}

// Global functions for UI controls
window.resetState = function() {
    appState.current = 'WAITING';
    appState.personDetectedTime = 0;
    appState.pulseStartTime = 0;
    appState.lastPersonArea = 0;
    appState.consecutiveDetections = 0;
    currentEdges = null;
    placedImages = [];
    updateStatus("Reset complete - waiting for person...", 'waiting');
    console.log("Experience reset");
}

window.toggleDebug = function() {
    debugMode = !debugMode;
    console.log("Debug mode:", debugMode ? "ON" : "OFF");
}

// Keyboard shortcuts for development
function keyPressed() {
    if (key === 'r' || key === 'R') {
        window.resetState();
    } else if (key === 'd' || key === 'D') {
        window.toggleDebug();
    } else if (key === 'p' || key === 'P') {
        // Skip to placement for testing
        if (currentEdges) {
            transitionToPlacement();
        }
    }
}