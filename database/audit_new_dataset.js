/**
 * Parse CSV sections from user message and run thorough comparison with MySQL kuliner_bebek
 */
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

// We will save the CSV text into a data file for precise auditing
