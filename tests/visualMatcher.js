const fs = require('fs');
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

/**
 * Compares a screenshot buffer against a baseline reference image.
 * If the baseline doesn't exist, or UPDATE_SCREENSHOTS=true is set, it updates the baseline.
 * If there is a mismatch, saves a diff image and returns the result.
 * 
 * @param {Buffer} actualBuffer - The screenshot buffer just taken.
 * @param {string} scenarioName - Unique name for the test scenario (e.g. 'portfolio-initial').
 * @param {number} threshold - Color difference threshold (0 to 1). Default is 0.1.
 * @param {number} toleranceRatio - Allowed ratio of different pixels (0 to 1). Default is 0.0005 (0.05%).
 * @returns {object} { pass: boolean, message?: string, updated?: boolean, diffPixels?: number }
 */
function compareScreenshot(actualBuffer, scenarioName, threshold = 0.1, toleranceRatio = 0.0005) {
  const referencesDir = path.join(__dirname, 'visual-references');
  const diffsDir = path.join(__dirname, 'visual-diffs');
  
  // Ensure directories exist
  if (!fs.existsSync(referencesDir)) {
    fs.mkdirSync(referencesDir, { recursive: true });
  }
  if (!fs.existsSync(diffsDir)) {
    fs.mkdirSync(diffsDir, { recursive: true });
  }

  const referencePath = path.join(referencesDir, `${scenarioName}.png`);
  const diffPath = path.join(diffsDir, `${scenarioName}-diff.png`);

  const updateRequested = process.env.UPDATE_SCREENSHOTS === 'true';
  const referenceExists = fs.existsSync(referencePath);

  // If we need to write/update the baseline reference
  if (!referenceExists || updateRequested) {
    fs.writeFileSync(referencePath, actualBuffer);
    
    // Clean up any old diff file if it existed
    if (fs.existsSync(diffPath)) {
      try {
        fs.unlinkSync(diffPath);
      } catch (err) {
        // Ignore errors deleting stale diff files
      }
    }

    return {
      pass: true,
      updated: true,
      message: `Baseline reference saved/updated for: ${scenarioName}`
    };
  }

  // Read the reference image
  const referenceBuffer = fs.readFileSync(referencePath);
  const refImg = PNG.sync.read(referenceBuffer);
  const actualImg = PNG.sync.read(actualBuffer);

  // Check dimension mismatches
  if (refImg.width !== actualImg.width || refImg.height !== actualImg.height) {
    // Write actual image to diff directory or temp to help debugging if sizes mismatch
    const sizeMismatchPath = path.join(diffsDir, `${scenarioName}-actual-size-mismatch.png`);
    fs.writeFileSync(sizeMismatchPath, actualBuffer);
    return {
      pass: false,
      message: `Dimension mismatch for "${scenarioName}". Reference is ${refImg.width}x${refImg.height}, but actual screenshot is ${actualImg.width}x${actualImg.height}. Actual saved to tests/visual-diffs/${scenarioName}-actual-size-mismatch.png`
    };
  }

  // Perform pixel comparison
  const totalPixels = refImg.width * refImg.height;
  const diffImg = new PNG({ width: refImg.width, height: refImg.height });

  const diffPixels = pixelmatch(
    refImg.data,
    actualImg.data,
    diffImg.data,
    refImg.width,
    refImg.height,
    { threshold }
  );

  const currentRatio = diffPixels / totalPixels;

  if (currentRatio > toleranceRatio) {
    // Write diff image
    const diffBuffer = PNG.sync.write(diffImg);
    fs.writeFileSync(diffPath, diffBuffer);

    // Also write actual image to diffs folder to inspect easily
    const failedActualPath = path.join(diffsDir, `${scenarioName}-actual.png`);
    fs.writeFileSync(failedActualPath, actualBuffer);

    return {
      pass: false,
      diffPixels,
      message: `Visual mismatch detected for "${scenarioName}". ${diffPixels} pixels differed (${(currentRatio * 100).toFixed(3)}%). Allowed tolerance: ${(toleranceRatio * 100).toFixed(3)}%.\n- Baseline: tests/visual-references/${scenarioName}.png\n- Diff Highlight: tests/visual-diffs/${scenarioName}-diff.png\n- Actual: tests/visual-diffs/${scenarioName}-actual.png`
    };
  }

  // Success: delete any old diff files if they exist
  if (fs.existsSync(diffPath)) {
    try {
      fs.unlinkSync(diffPath);
    } catch (err) {}
  }
  const failedActualPath = path.join(diffsDir, `${scenarioName}-actual.png`);
  if (fs.existsSync(failedActualPath)) {
    try {
      fs.unlinkSync(failedActualPath);
    } catch (err) {}
  }

  return {
    pass: true,
    diffPixels,
    message: `Visual match passed for "${scenarioName}".`
  };
}

module.exports = {
  compareScreenshot
};
