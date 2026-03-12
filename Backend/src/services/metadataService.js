const exifr = require("exifr");
const logger = require("../utils/logger");

/**
 * Extract metadata from an image file.
 * Returns timestamps, camera info, and any available EXIF data.
 */
async function extractMetadata(filePath) {
  try {
    const metadata = await exifr.parse(filePath, {
      // Extract all available tags
      tiff: true,
      xmp: true,
      icc: false,
      iptc: true,
      jfif: true,
      ihdr: true,
    });

    if (!metadata) {
      return { hasMetadata: false };
    }

    // Extract useful timestamps
    const timestamps = [];
    const dateFields = [
      "DateTimeOriginal",
      "CreateDate",
      "ModifyDate",
      "DateTimeDigitized",
      "GPSDateStamp",
    ];

    for (const field of dateFields) {
      if (metadata[field]) {
        timestamps.push({
          source: field,
          date: new Date(metadata[field]),
        });
      }
    }

    // Sort timestamps to get the earliest (most likely capture time)
    timestamps.sort((a, b) => a.date - b.date);

    return {
      hasMetadata: true,
      timestamps,
      earliestDate: timestamps.length > 0 ? timestamps[0].date : null,
      orientation: metadata.Orientation || null,
      imageWidth: metadata.ImageWidth || metadata.ExifImageWidth || null,
      imageHeight: metadata.ImageHeight || metadata.ExifImageHeight || null,
      rawMetadata: metadata,
    };
  } catch (err) {
    logger.debug(`No EXIF metadata found for ${filePath}: ${err.message}`);
    return { hasMetadata: false };
  }
}

module.exports = { extractMetadata };
