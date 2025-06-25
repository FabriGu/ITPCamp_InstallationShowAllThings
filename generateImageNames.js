const fs = require('fs');
const path = require('path');

// Define the path to the images folder (subdirectory of current location)
const imagesFolderPath = path.join(__dirname, 'images');

// Define the output file path
const outputFilePath = path.join(__dirname, 'imageNames.js');

try {
    // Check if the images folder exists
    if (!fs.existsSync(imagesFolderPath)) {
        console.error('Error: The "images" folder does not exist in the current directory.');
        console.log('Please create an "images" folder and add your image files to it.');
        process.exit(1);
    }

    // Read all files from the images directory
    const allItems = fs.readdirSync(imagesFolderPath);
    
    // Filter to get only files (not subdirectories) and sort them alphabetically
    const imageFiles = allItems
        .filter(item => {
            const itemPath = path.join(imagesFolderPath, item);
            return fs.statSync(itemPath).isFile();
        })
        .sort(); // Sort alphabetically for consistent output

    // Check if any files were found
    if (imageFiles.length === 0) {
        console.log('No files found in the images folder.');
        process.exit(0);
    }

    // Format the filenames into the desired JavaScript array format
    // We'll format them with proper indentation and line breaks
    const formattedFilenames = imageFiles
        .map(filename => `'${filename}'`)  // Wrap each filename in single quotes
        .reduce((acc, filename, index) => {
            // Add filename to current line
            if (index === 0) {
                acc.push(`        ${filename}`);
            } else if ((index) % 4 === 0) {
                // Start a new line every 4 items (after index 3, 7, 11, etc.)
                acc.push(`\n        ${filename}`);
            } else {
                // Add to current line with comma and space
                acc[acc.length - 1] += `, ${filename}`;
            }
            return acc;
        }, [])
        .join('');

    // Create the complete JavaScript file content
    const fileContent = `const imageFilenames = [
${formattedFilenames}
    ];

module.exports = imageFilenames;`;

    // Write the content to the output file
    fs.writeFileSync(outputFilePath, fileContent, 'utf8');

    // Provide feedback to the user
    console.log(`✅ Success! Generated imageNames.js with ${imageFiles.length} image filenames.`);
    console.log(`📁 Files found: ${imageFiles.join(', ')}`);
    console.log(`📄 Output saved to: ${outputFilePath}`);

} catch (error) {
    console.error('❌ An error occurred:', error.message);
    process.exit(1);
}