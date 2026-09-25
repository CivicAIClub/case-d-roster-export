/**
 * Sundial (Blackbaud MySchoolApp) API integration via SKY API.
 *
 * STATUS: PLACEHOLDER — Requires school admin to:
 *   1. Enable SKY API access on Pomfret's Blackbaud instance
 *   2. Register this application in the Blackbaud Marketplace
 *   3. Provide the client ID and client secret
 *
 * API Docs: https://developer.blackbaud.com/skyapi/apis/school
 * Auth: OAuth 2.0 (Authorization Code flow)
 * Base URL: https://api.sky.blackbaud.com/school/v1
 */
// SundialAPI.gs: Phase 2 of the tool, which would send the teacher's finished comments into
// Sundial (the school's report system, run by a company called Blackbaud).
// IMPORTANT: this part is BLOCKED and does not work yet. Talking to Sundial needs Blackbaud's
// "SKY API" (a way for programs, not people, to read and write Sundial data), and school IT
// has not yet turned on that access or registered this tool. Most functions below are
// placeholders that stop with a "not yet implemented" message.
// When finished, it would log in to Sundial for the teacher, get the teacher's classes and
// student lists from Sundial, and send in each comment that DocReader.gs read from the Google
// Docs. Code.gs, SundialSetup.html, and ExportDialog.html call the functions here.
// Notes marked "TODO" are reminders of unfinished work.

// The fixed web addresses this tool would use to talk to Blackbaud: the page where the teacher
// logs in and approves the tool, the address where the tool trades that approval for a token
// (a long secret password), and the main address for asking Sundial for data.
var SUNDIAL_CONFIG = {
  AUTH_URL: 'https://oauth2.sky.blackbaud.com/authorization',
  TOKEN_URL: 'https://oauth2.sky.blackbaud.com/token',
  API_BASE: 'https://api.sky.blackbaud.com/school/v1',
  // Blackbaud also wants a "subscription key" sent with every request, under this label.
  // (Note: sundialRequest_ below types the label out itself instead of using this one.)
  // Subscription key from Blackbaud developer portal
  SUBSCRIPTION_KEY_HEADER: 'Bb-Api-Subscription-Key'
};

// ─────────────────────────────────────────────
// Authentication (OAuth 2.0)
// ─────────────────────────────────────────────

// The functions in this part handle logging in to Sundial. Blackbaud uses "OAuth", a common
// login process where the teacher signs in on Blackbaud's own website and approves this tool,
// and Blackbaud then gives the tool a token to use on the teacher's behalf.
//
// Save the three Sundial access codes the teacher types into the setup pop-up
// (SundialSetup.html): the client ID and client secret (like a username and password for this
// tool, which school IT would get when it registers the tool) and the subscription key.
// They go in "user properties", Google's private storage for each person, never in the code.
// It gives nothing back.
/**
 * Saves Sundial API credentials to user properties.
 * Called from SundialSetup.html dialog.
 */
function saveSundialCredentials(clientId, clientSecret, subscriptionKey) {
  // Open this teacher's private storage and save each of the three codes under its own name.
  var props = PropertiesService.getUserProperties();
  props.setProperty('SUNDIAL_CLIENT_ID', clientId);
  props.setProperty('SUNDIAL_CLIENT_SECRET', clientSecret);
  props.setProperty('SUNDIAL_SUBSCRIPTION_KEY', subscriptionKey);
}

// Build the link to Blackbaud's sign-in page, where the teacher would approve this tool.
// It is given nothing and gives back the link. Nothing in the tool calls this yet.
/**
 * Returns the OAuth 2.0 authorization URL for the user to grant access.
 * The user visits this URL, logs into Blackbaud, and approves the app.
 *
 * TODO: Implement once school admin provides client credentials.
 * Will use Apps Script OAuth2 library or manual token exchange.
 *
 * @returns {string} Authorization URL
 */
function getSundialAuthUrl() {
  // Look up the saved client ID. Without it, stop and tell the teacher to use the setup menu first.
  var props = PropertiesService.getUserProperties();
  var clientId = props.getProperty('SUNDIAL_CLIENT_ID');

  if (!clientId) {
    throw new Error('Sundial API credentials not configured. Go to: Sundial Export → Connect to Sundial');
  }

  // Build the link: Blackbaud's sign-in address, plus details saying which tool is asking (the
  // client ID), that we want a one-time code back, where Blackbaud should send the teacher
  // afterward, and that we want to both read and write data. "encodeURIComponent" makes each
  // value safe to put inside a web link.
  var redirectUri = getRedirectUri_();
  var authUrl = SUNDIAL_CONFIG.AUTH_URL +
    '?client_id=' + encodeURIComponent(clientId) +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=read write';

  // TODO: Add state parameter for CSRF protection
  // Hand back the finished link.
  return authUrl;
}

// After the teacher approves the tool on Blackbaud's site, Blackbaud sends back a one-time
// code. This function is meant to trade that code for the tokens the tool needs, and save
// them. It is given the code and would give back true if it worked.
// Not built yet: right now it always stops with a "not yet implemented" message.
/**
 * Handles the OAuth callback after the user authorizes the app.
 * Exchanges the authorization code for access + refresh tokens.
 *
 * TODO: Implement token exchange and storage.
 *
 * @param {string} authCode - The authorization code from Blackbaud
 * @returns {boolean} True if tokens were stored successfully
 */
function handleSundialCallback(authCode) {
  // Look up the tool's saved client ID and secret (needed for the trade).
  var props = PropertiesService.getUserProperties();
  var clientId = props.getProperty('SUNDIAL_CLIENT_ID');
  var clientSecret = props.getProperty('SUNDIAL_CLIENT_SECRET');

  // The greyed-out lines below are the planned steps: send the code, ID, and secret to Blackbaud,
  // then save the access token, the refresh token (used to get a new access token later), and
  // the time the access token runs out.
  // TODO: Exchange auth code for tokens
  // var response = UrlFetchApp.fetch(SUNDIAL_CONFIG.TOKEN_URL, {
  //   method: 'post',
  //   payload: {
  //     grant_type: 'authorization_code',
  //     code: authCode,
  //     client_id: clientId,
  //     client_secret: clientSecret,
  //     redirect_uri: getRedirectUri_()
  //   },
  //   muteHttpExceptions: true
  // });
  //
  // var tokens = JSON.parse(response.getContentText());
  // props.setProperty('SUNDIAL_ACCESS_TOKEN', tokens.access_token);
  // props.setProperty('SUNDIAL_REFRESH_TOKEN', tokens.refresh_token);
  // props.setProperty('SUNDIAL_TOKEN_EXPIRY', String(Date.now() + tokens.expires_in * 1000));

  // Until this is built, stop here with a message explaining why.
  throw new Error('Sundial OAuth callback not yet implemented. Waiting for school admin to provide API credentials.');
}

// Get the saved Sundial token so the tool can make a request. It is given nothing and gives
// back the token. If there is no token, or it has expired (or will within a minute), it stops
// with a message asking the teacher to reconnect. Renewing a token automatically isn't built.
/**
 * Returns a valid access token, refreshing if expired.
 *
 * TODO: Implement token refresh logic.
 *
 * @returns {string} Valid access token
 */
function getSundialAccessToken_() {
  // Look up the saved token and the time it runs out (stored as a count of milliseconds, or 0 if
  // nothing is saved).
  var props = PropertiesService.getUserProperties();
  var accessToken = props.getProperty('SUNDIAL_ACCESS_TOKEN');
  var expiry = Number(props.getProperty('SUNDIAL_TOKEN_EXPIRY') || 0);

  // No token saved means the teacher never finished connecting to Sundial.
  if (!accessToken) {
    throw new Error('Not connected to Sundial. Go to: Sundial Export → Connect to Sundial');
  }

  // Refresh if expired (with 60s buffer)
  // Date.now() is the current time in milliseconds. 60000 milliseconds is one minute, so this
  // treats a token as expired a minute early, so it won't run out in the middle of a request.
  if (Date.now() > expiry - 60000) {
    // TODO: Implement refresh
    // var refreshToken = props.getProperty('SUNDIAL_REFRESH_TOKEN');
    // ... refresh logic ...
    throw new Error('Sundial token expired. Please reconnect via: Sundial Export → Connect to Sundial');
  }

  // The token is still good, so hand it back.
  return accessToken;
}

// The address Blackbaud should send the teacher back to after they approve the tool. It uses
// this project's own web address. Note: that address only exists if the project has been
// published as a web app, and nothing in the project handles that return visit yet.
/**
 * Returns the OAuth redirect URI for this Apps Script project.
 * @returns {string} Redirect URI
 */
function getRedirectUri_() {
  return ScriptApp.getService().getUrl();
}

// ─────────────────────────────────────────────
// API Helpers
// ─────────────────────────────────────────────

// The one shared helper that every Sundial request would go through.
// It is given the part of the address after the main Sundial address (like '/users/me'), the
// kind of request ('get' to read, 'post', 'put', or 'patch' to send or change data), and
// sometimes the data to send. It gives back Sundial's answer as data the tool can use.
/**
 * Makes an authenticated request to the Sundial SKY API.
 *
 * @param {string} endpoint - API path (e.g., '/users/me')
 * @param {string} method - HTTP method (GET, POST, PUT, PATCH)
 * @param {Object} [payload] - Request body for POST/PUT/PATCH
 * @returns {Object} Parsed JSON response
 */
function sundialRequest_(endpoint, method, payload) {
  // Get a valid token and the saved subscription key. Blackbaud requires both on every request.
  var token = getSundialAccessToken_();
  var subscriptionKey = PropertiesService.getUserProperties().getProperty('SUNDIAL_SUBSCRIPTION_KEY');

  // Set up the request: its kind (reading, if none is given), the token and subscription key in
  // the headers (extra details sent along with a request), and "muteHttpExceptions" so an error
  // from Sundial doesn't stop the tool before we can explain it.
  var options = {
    method: method || 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Bb-Api-Subscription-Key': subscriptionKey
    },
    muteHttpExceptions: true
  };

  // If we are sending data, write it out as JSON (a standard way of writing data as plain text)
  // and label it that way. Note: this only happens if the kind is written in small letters,
  // like 'post'.
  if (payload && (method === 'post' || method === 'put' || method === 'patch')) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  // Send the request to Sundial and read the status number it answers with.
  var response = UrlFetchApp.fetch(SUNDIAL_CONFIG.API_BASE + endpoint, options);
  var code = response.getResponseCode();

  // Any status outside 200 to 299 means something went wrong. Stop with the start of Sundial's
  // error message (up to 300 characters).
  if (code < 200 || code >= 300) {
    throw new Error('Sundial API error (' + code + '): ' + response.getContentText().substring(0, 300));
  }

  // Turn Sundial's answer into data the tool can use. An empty answer becomes empty data.
  var text = response.getContentText();
  return text ? JSON.parse(text) : {};
}

// ─────────────────────────────────────────────
// Read Endpoints (Pull data from Sundial)
// ─────────────────────────────────────────────

// Get the list of classes this teacher teaches, according to Sundial, so each comment doc can
// be matched to the right Sundial class. It is given nothing and would give back each class's
// Sundial ID, course name, section name, and term.
// Not built yet: it always stops with a "not yet implemented" message.
/**
 * Gets the sections (classes) taught by the currently authenticated teacher.
 *
 * SKY API: GET /academics/sections
 * PowerShell equivalent: Get-SchoolSectionByTeacher
 *
 * TODO: Confirm exact endpoint path and query parameters once API access is granted.
 *
 * @returns {Array} [{section_id, course_name, section_name, term}]
 */
function getSundialSections() {
  // The greyed-out lines are a guess at how this will work once access is granted.
  // TODO: Replace with actual API call
  // var data = sundialRequest_('/academics/sections?teacher_id=me', 'get');
  // return data.value.map(function(s) {
  //   return {
  //     section_id: s.id,
  //     course_name: s.course_title,
  //     section_name: s.name,
  //     term: s.term
  //   };
  // });

  // Until then, stop with a message explaining why.
  throw new Error(
    'getSundialSections() is not yet implemented.\n\n' +
    'Waiting for school admin to enable SKY API access.\n' +
    'Expected endpoint: GET /academics/sections'
  );
}

// Get the list of students in one Sundial class, so each student in a comment doc can be
// matched to their Sundial record. It is given the class's Sundial ID and would give back each
// student's Sundial ID, first name, last name, and full name written "Last, First" (the same
// style Canvas uses, so the names can be compared).
// Not built yet: it always stops with a "not yet implemented" message.
/**
 * Gets the student roster for a specific section.
 *
 * SKY API: GET /academics/sections/{section_id}/students
 * PowerShell equivalent: Get-SchoolStudentBySection
 *
 * TODO: Confirm exact endpoint path and response format.
 *
 * @param {string} sectionId - Sundial section ID
 * @returns {Array} [{student_id, first_name, last_name, name}]
 */
function getSundialRoster(sectionId) {
  // The greyed-out lines are a guess at how this will work once access is granted.
  // TODO: Replace with actual API call
  // var data = sundialRequest_('/academics/sections/' + sectionId + '/students', 'get');
  // return data.value.map(function(s) {
  //   return {
  //     student_id: s.id,
  //     first_name: s.first_name,
  //     last_name: s.last_name,
  //     name: s.last_name + ', ' + s.first_name
  //   };
  // });

  // Until then, stop with a message explaining why.
  throw new Error(
    'getSundialRoster() is not yet implemented.\n\n' +
    'Waiting for school admin to enable SKY API access.\n' +
    'Expected endpoint: GET /academics/sections/{id}/students'
  );
}

// ─────────────────────────────────────────────
// Write Endpoints (Push comments to Sundial)
// ─────────────────────────────────────────────

// Send one student's comment into Sundial. It is given the Sundial class ID, the student's
// Sundial ID, the comment, and the Sundial ID of the grading term.
// Not built yet. The bigger problem: nobody has confirmed that Sundial even offers a way for
// programs to write report comments. It always stops with a message saying so.
/**
 * Pushes a single student's comment into Sundial.
 *
 * IMPORTANT: The exact endpoint for writing progress report comments
 * has NOT been confirmed in the public SKY API docs. Possible endpoints:
 *   - POST /content/comments
 *   - PUT  /academics/sections/{id}/students/{id}/comments
 *   - POST /progress-reports (if such an endpoint exists)
 *
 * The school admin needs to check the SKY API console or contact
 * Blackbaud support to confirm the correct endpoint and payload format.
 *
 * @param {string} sectionId - Sundial section ID
 * @param {string} studentId - Sundial student ID
 * @param {string} comment - The teacher's comment text
 * @param {string} termId - The grading term/period ID in Sundial
 * @returns {Object} API response
 */
function pushCommentToSundial(sectionId, studentId, comment, termId) {
  // The greyed-out lines are two guesses at what the request might look like. Neither one has
  // been confirmed.
  // TODO: Replace with actual API call once endpoint is confirmed
  //
  // Possible payload structure (speculative):
  // var payload = {
  //   student_id: studentId,
  //   section_id: sectionId,
  //   term_id: termId,
  //   comment_text: comment,
  //   comment_type: 'progress_report'
  // };
  //
  // return sundialRequest_('/progress-reports/comments', 'post', payload);
  //
  // OR it might be:
  // return sundialRequest_(
  //   '/academics/sections/' + sectionId + '/students/' + studentId + '/comments',
  //   'post',
  //   { text: comment, term_id: termId }
  // );

  // Until the right address is confirmed, stop with a message explaining why.
  throw new Error(
    'pushCommentToSundial() is not yet implemented.\n\n' +
    'The comment write endpoint has not been confirmed in the SKY API docs.\n' +
    'School admin needs to check the SKY API console or contact Blackbaud support.'
  );
}

// Send every comment for one class into Sundial, one student at a time, and keep score.
// It is given the Sundial class ID, the list of students (Sundial ID and comment), and the
// grading term's ID. It gives back how many were sent, how many failed, and why each failed.
// Students with no comment are skipped, and one failure doesn't stop the rest.
// Note: because pushCommentToSundial isn't built yet, every attempt currently fails.
/**
 * Pushes all comments for a section to Sundial in bulk.
 * Reads from the Google Doc, matches students, and sends each comment.
 *
 * @param {string} sectionId - Sundial section ID
 * @param {Array} studentComments - [{student_id, comment}]
 * @param {string} termId - Grading term ID
 * @returns {Object} Summary: {success: number, failed: number, errors: []}
 */
function pushAllCommentsForSection(sectionId, studentComments, termId) {
  // Start the score at zero sent, zero failed, and no error messages.
  var results = { success: 0, failed: 0, errors: [] };

  // Go through the students one at a time. If a student's comment is blank, skip them.
  for (var i = 0; i < studentComments.length; i++) {
    var sc = studentComments[i];
    if (!sc.comment || sc.comment.trim() === '') continue;

    // Try to send the comment. If it works, add one to "sent". If not, add one to "failed", note
    // which student it was and what went wrong, and carry on with the next student.
    try {
      pushCommentToSundial(sectionId, sc.student_id, sc.comment, termId);
      results.success++;
    } catch (e) {
      results.failed++;
      results.errors.push(sc.student_id + ': ' + e.message);
    }
  }

  // Hand back the score.
  return results;
}

// Check whether the tool is ready to talk to Sundial. Code.gs calls this before opening the
// export pop-up, and the setup pop-up (SundialSetup.html) calls it to show a status message.
// It is given nothing and gives back yes or no ("connected") plus a message for the teacher.
// Right now it never answers yes: even with everything saved, the final check isn't built.
/**
 * Checks whether the Sundial API connection is active and working.
 * @returns {Object} {connected: boolean, message: string}
 */
function checkSundialConnection() {
  // Look up the saved client ID and Sundial token.
  var props = PropertiesService.getUserProperties();
  var clientId = props.getProperty('SUNDIAL_CLIENT_ID');
  var accessToken = props.getProperty('SUNDIAL_ACCESS_TOKEN');

  // No client ID means the setup codes were never entered. No token means the teacher never
  // finished logging in to Sundial.
  if (!clientId) {
    return { connected: false, message: 'API credentials not configured.' };
  }
  if (!accessToken) {
    return { connected: false, message: 'Not authenticated. Please connect to Sundial.' };
  }

  // The greyed-out lines would make a small test request to Sundial to confirm the token works.
  // TODO: Make a lightweight API call to verify the token works
  // try {
  //   sundialRequest_('/users/me', 'get');
  //   return { connected: true, message: 'Connected to Sundial.' };
  // } catch (e) {
  //   return { connected: false, message: 'Connection failed: ' + e.message };
  // }

  // Until that test is built, always answer "not connected".
  return { connected: false, message: 'Connection check not yet implemented.' };
}
