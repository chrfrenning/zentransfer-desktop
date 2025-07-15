const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('../utils/Logger.js');

function getCacheFilePath() {
    const configDir = app.configurationManager.getConfigDirectory();
    return path.join(configDir, 'awsregions.json');
}

function isCacheExpired(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return true;
        }

        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtime.getTime();
        const oneWeekInMs = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds
        
        return fileAge > oneWeekInMs;
    } catch (error) {
        logger.error('Error checking cache file age:', error);
        return true; // Treat errors as expired cache
    }
}

function loadRegionsFromCache(filePath) {
    try {
        const cacheData = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(cacheData);
        
        if (Array.isArray(parsedData.regions) && parsedData.regions.length > 0) {
            logger.info(`Loaded ${parsedData.regions.length} AWS regions from cache`);
            return parsedData.regions;
        }
        
        return null;
    } catch (error) {
        logger.error('Failed to load regions from cache:', error);
        return null;
    }
}

async function fetchRegionsFromAWS() {
    logger.info('Fetching AWS regions from remote endpoint');
    
    const response = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json');
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract unique regions from the IP ranges data
    const regions = new Set();
    data.prefixes.forEach(prefix => {
        if (prefix.region && prefix.service === 'S3') {
            if (prefix.region !== "GLOBAL") {
                regions.add(prefix.region);
            }
        }
    });

    // Convert to array and sort
    const sortedRegions = Array.from(regions).sort();
    
    if (sortedRegions.length === 0) {
        throw new Error('No regions found in AWS response');
    }

    logger.info(`Fetched ${sortedRegions.length} AWS regions from remote endpoint`);
    return sortedRegions;
}

function saveRegionsToCache(regions, filePath) {
    try {
        const cacheData = {
            regions: regions,
            cachedAt: new Date().toISOString(),
            source: 'aws-ip-ranges'
        };

        // Ensure the directory exists
        const cacheDir = path.dirname(filePath);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf8');
        logger.info(`Saved ${regions.length} AWS regions to cache`);
        
    } catch (error) {
        logger.error('Failed to save regions to cache:', error);
        // Continue without caching - not a critical failure
    }
}

async function awsLoadRegions() {
    try {
        const cacheFilePath = getCacheFilePath();
        
        // Check if cache exists and is not expired
        if (!isCacheExpired(cacheFilePath)) {
            const cachedRegions = loadRegionsFromCache(cacheFilePath);
            if (cachedRegions) {
                return cachedRegions;
            }
        }

        // Cache is expired or invalid, fetch from AWS
        const regions = await fetchRegionsFromAWS();
        
        // Save to cache for future use
        saveRegionsToCache(regions, cacheFilePath);
        
        return regions;

    } catch (error) {
        logger.error('Critical error in awsLoadRegions:', error);
        
        // As a last resort, try to load from cache even if expired
        const cacheFilePath = getCacheFilePath();
        const cachedRegions = loadRegionsFromCache(cacheFilePath);
        
        if (cachedRegions) {
            logger.warn('Using expired cache due to error');
            return cachedRegions;
        }
        
        // If all else fails, return minimal fallback
        const fallbackRegions = ['us-east-1', 'us-west-2', 'eu-west-1'];
        logger.error('Using minimal fallback region list');
        return fallbackRegions;
    }
}

module.exports = { awsLoadRegions };