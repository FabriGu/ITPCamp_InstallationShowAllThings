/*
 * Simplified sketch.js - Continuous body outline installation
 * 
 * This creates a seamless, always-running experience where:
 * - People walk into view and see their outline
 * - Images are placed automatically after brief stability
 * - Experience continues indefinitely without manual resets
 * - Old images fade away to prevent screen clutter
 */

// Canvas dimensions optimized for webcam input
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// Experience flow constants
const STABILITY_TIME = 3000; // 3 seconds of stable detection before placement
const MIN_PERSON_AREA = 5000; // Minimum area to consider valid detection
const MAX_IMAGES_ON_SCREEN = 20; // Maximum images before fading begins
const IMAGE_FADE_RATE = 0.02; // How fast old images fade away

// Simple state management
let isPersonDetected = false;
let detectionStartTime = 0;
let consecutiveDetections = 0;

// Visual elements
let video;
let currentEdges = null;
let placedImages = []; // Array of placed image objects with fade properties
let availableImages = []; // Array of loaded image assets

function setup() {
    // Create fullscreen-ready canvas
    let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('canvas-container');
    
    // Initialize video capture
    video = createCapture(VIDEO);
    video.size(CANVAS_WIDTH, CANVAS_HEIGHT);
    video.hide();
    
    // Load available images from the images folder
    loadAvailableImages();
    
    // Initialize body segmentation (keeping the existing working code)
    initializeBodySegmentation(video, onSegmentationResult);
    
    console.log("Installation started - waiting for people to interact");
}

function draw() {
    // Always white background for clean installation aesthetic
    background(255);
    
    // Draw all placed images with their current opacity
    drawPlacedImages();
    
    // Draw the current person's outline if detected
    if (currentEdges) {
        drawEdges(currentEdges, color(0), 2);
    }
    
    // Handle image fading when screen gets too full
    manageImageFading();
}

function loadAvailableImages() {
    // Pre-define common image filenames that might exist in the images folder
    // In a real setup, you'd scan the directory or have a manifest file
    const imageFilenames = [
        'image1.jpg', 'image2.jpg', 'image3.jpg', 'image4.jpg', 'image5.jpg',
        'image1.png', 'image2.png', 'image3.png', 'image4.png', 'image5.png',
        'photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg'
    ];
    
    // Attempt to load each image, silently skipping ones that don't exist
    for (let filename of imageFilenames) {
        loadImage(`images/${filename}`, 
            (img) => {
                availableImages.push(img);
                console.log(`Loaded image: ${filename}`);
            },
            () => {
                // Silently ignore missing images
            }
        );
    }
    
    // If no images are found, we'll use colored rectangles as fallback
    console.log("Attempting to load images from images/ folder");
}

function onSegmentationResult(segmentation) {
    if (!segmentation || !segmentation.mask) {
        handleNoDetection();
        return;
    }
    
    // Extract edges and calculate person area
    currentEdges = extractEdgesFromMask(segmentation.mask);
    let personArea = calculatePersonArea(segmentation.mask);
    
    // Check if detection is valid and stable
    if (personArea > MIN_PERSON_AREA) {
        handlePersonDetected();
    } else {
        handleNoDetection();
    }
}

function handlePersonDetected() {
    if (!isPersonDetected) {
        // First detection - start stability timer
        isPersonDetected = true;
        detectionStartTime = millis();
        consecutiveDetections = 1;
        console.log("Person detected - checking stability");
    } else {
        // Continue tracking stability
        consecutiveDetections++;
        
        // Check if person has been stable long enough for placement
        if (millis() - detectionStartTime >= STABILITY_TIME && consecutiveDetections > 20) {
            placeImagesForCurrentPerson();
            // Reset detection to allow for new people
            isPersonDetected = false;
            consecutiveDetections = 0;
        }
    }
}

function handleNoDetection() {
    // Person left or no detection - clear outline but keep placed images
    isPersonDetected = false;
    consecutiveDetections = 0;
    currentEdges = null;
}

function placeImagesForCurrentPerson() {
    if (!currentEdges) return;
    
    console.log("Placing images for detected person");
    
    // Use the existing placement algorithm to get rectangle positions
    let rectanglePositions = placeImagesInBodyOutline(currentEdges, 6);
    
    // Convert rectangles to image objects with fade properties
    for (let rect of rectanglePositions) {
        let imageObj = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            opacity: 1.0, // Start fully opaque
            image: getRandomImage(),
            birthTime: millis()
        };
        
        placedImages.push(imageObj);
    }
    
    console.log(`Placed ${rectanglePositions.length} images, total on screen: ${placedImages.length}`);
}

function getRandomImage() {
    // Return a random image from available images, or null if none loaded
    if (availableImages.length > 0) {
        return random(availableImages);
    }
    return null;
}

function drawPlacedImages() {
    for (let img of placedImages) {
        // Set opacity for fading effect
        tint(255, img.opacity * 255);
        
        if (img.image) {
            // Draw actual loaded image
            image(img.image, img.x, img.y, img.width, img.height);
        } else {
            // Fallback: draw colored rectangle if no images loaded
            fill(random(50, 200), random(50, 200), random(50, 200), img.opacity * 255);
            noStroke();
            rect(img.x, img.y, img.width, img.height);
        }
    }
    
    // Reset tint for other drawing operations
    noTint();
}

function manageImageFading() {
    // Start fading images if we have too many on screen
    if (placedImages.length > MAX_IMAGES_ON_SCREEN) {
        // Sort by age (oldest first) and fade the oldest ones
        placedImages.sort((a, b) => a.birthTime - b.birthTime);
        
        let imagesToFade = placedImages.length - MAX_IMAGES_ON_SCREEN;
        
        for (let i = 0; i < imagesToFade && i < placedImages.length; i++) {
            placedImages[i].opacity -= IMAGE_FADE_RATE;
            
            // Remove completely faded images
            if (placedImages[i].opacity <= 0) {
                placedImages.splice(i, 1);
                i--; // Adjust index after removal
            }
        }
    }
}

function calculatePersonArea(mask) {
    // Efficiently estimate person area by sampling pixels
    mask.loadPixels();
    let area = 0;
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < mask.pixels.length; i += 16) {
        if (mask.pixels[i + 3] > 128) { // Check alpha channel
            area += 4; // Account for sampling rate
        }
    }
    
    return area;
}

// Development helper - press 'p' to simulate placing images
function keyPressed() {
    if (key === 'p' || key === 'P') {
        if (currentEdges) {
            placeImagesForCurrentPerson();
        }
    }
}