/**
 * Google Apps Script Web App Macro Handler
 * Copy this code into your Google Apps Script editor.
 * 
 * Set the script property "GEMINI_API_KEY" under Project Settings.
 */

function doPost(e) {
  var requestData;
  try {
    requestData = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("Error: Invalid JSON payload").setMimeType(ContentService.MimeType.TEXT);
  }
  
  // Handshake for AI Journal digest summary
  if (requestData.action === 'getAIJournalSummary') {
    var notes = requestData.notes || [];
    var range = requestData.range || 'daily';
    var summary = generateGeminiSummary(notes, range);
    return ContentService.createTextOutput(summary).setMimeType(ContentService.MimeType.TEXT);
  }
  
  // Standard spreadsheet POST append transaction logic (if any)
  // ...
  return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Connects to the Gemini API endpoint via UrlFetchApp to generate a trading notes digest
 */
function generateGeminiSummary(notes, range) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    return "Error: GEMINI_API_KEY script property is not set in Apps Script Project Settings.";
  }
  
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
  
  var systemInstruction = "You are a professional financial portfolio analyst tool. Synthesize these raw user trading journal notes and trade comments into a cohesive, easy-to-understand paragraph format summarizing the trades and their reasoning. Do not use lists, bullet points, or conversational intros like 'Here is your summary'. The summary must be a single continuous paragraph block for easy understanding of our trades.";
  
  var prompt = "Here is the period range parameter: " + range + "\n\nHere are the raw user trading journal notes:\n" + notes.map(function(n) { return "- " + n; }).join("\n");
  
  var payload = {
    "contents": [
      {
        "parts": [
          { "text": prompt }
        ]
      }
    ],
    "systemInstruction": {
      "parts": [
        { "text": systemInstruction }
      ]
    }
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode !== 200) {
      return "Error generating AI digest (Google Web App connection failed). code: " + responseCode;
    }
    
    var json = JSON.parse(responseText);
    if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
      return json.candidates[0].content.parts[0].text.trim();
    }
    return "No summary generated.";
  } catch (err) {
    return "Error connecting to Gemini API: " + err.toString();
  }
}
