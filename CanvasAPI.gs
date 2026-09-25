// CanvasAPI.gs: everything the tool needs to ask Canvas (the school's online class system)
// for information.
// It uses Canvas's API (a way for programs, not people, to ask a website for data) to get two
// things: the list of classes a teacher teaches, and the list of students in each class.
// Every request carries the teacher's token (a long secret password that lets this tool log in
// to Canvas for the teacher), which the teacher saved using "Set Canvas API Token".
// Code.gs calls these functions. The class list goes to the class-picker pop-up
// (CourseSelector.html), and the student lists go to DocBuilder.gs to become Google Docs.
// This file only reads from Canvas. It never changes anything in Canvas.
//
// Ask Canvas for every class this teacher is currently teaching.
// It is given the school's Canvas web address and the teacher's token.
// Canvas sends back a lot of detail about each class, so below we keep
// only the three things we need: its ID number, its name, and its short code.
/**
 * Fetches all active courses where the user is enrolled as a teacher.
 * @param {string} baseUrl - Canvas instance URL (e.g., https://school.instructure.com)
 * @param {string} token - Canvas API access token
 * @returns {Array} Simplified course objects [{id, name, course_code}]
 */
function getCourses(baseUrl, token) {
  // Build the web address that asks Canvas: "which active classes does this person teach?"
  // "per_page=100" asks for up to 100 classes at a time instead of Canvas's default of 10.
  var url = baseUrl + '/api/v1/courses?enrollment_type=teacher&enrollment_state=active&per_page=100';
  // Canvas splits long lists into "pages". This helper keeps asking for the next page
  // until it has every class, then hands back one complete list.
  var allCourses = fetchAllPages(url, token);

  // Go through each class Canvas sent back and keep just its ID number, name, and short code.
  // If a class has no name, its short code is used as the name instead. Hand back that list.
  return allCourses.map(function (c) {
    return {
      id: c.id,
      name: c.name || c.course_code,
      course_code: c.course_code
    };
  });
}

// Ask Canvas for the list of students in one class.
// It is given the school's Canvas web address, the teacher's token, and the class's ID number.
// It gives back the students in A-to-Z order by last name, each with their name (written
// "Last, First") and their Canvas ID number.
/**
 * Fetches the student roster for a specific course.
 * Returns students sorted alphabetically by last name.
 * @param {string} baseUrl - Canvas instance URL
 * @param {string} token - Canvas API access token
 * @param {number} courseId - Canvas course ID
 * @returns {Array} Sorted student objects [{name, id}]
 */
function getRoster(baseUrl, token, courseId) {
  // Build the web address that asks Canvas: "who are the students in this class?" Only students
  // are asked for, so teachers and assistants are left out. Again, up to 100 at a time.
  var url = baseUrl + '/api/v1/courses/' + courseId + '/users?enrollment_type[]=student&per_page=100';
  // Collect every page of students into one list (see fetchAllPages below).
  var allStudents = fetchAllPages(url, token);

  // Sort by sortable_name (format: "Last, First")
  // Canvas keeps a "sortable name" for each person, written "Last, First". Put the students in
  // A-to-Z order by that name, ignoring capital letters. If a student has no sortable name,
  // their regular name is used instead.
  allStudents.sort(function (a, b) {
    var nameA = (a.sortable_name || a.name || '').toLowerCase();
    var nameB = (b.sortable_name || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Keep only each student's name ("Last, First" when available) and ID number, and hand
  // back the list.
  return allStudents.map(function (s) {
    return {
      name: s.sortable_name || s.name,
      id: s.id
    };
  });
}

// Canvas never sends a long list all at once. It splits it into "pages" of at most 100 items,
// like pages of search results. This helper keeps asking for the next page until there are
// none left, then gives back everything as one list.
// It is given the web address of the first page and the teacher's token.
/**
 * Fetches all pages of a paginated Canvas API endpoint.
 * Canvas returns a max of 100 results per page with Link headers for pagination.
 * @param {string} url - Initial API URL
 * @param {string} token - Canvas API access token
 * @returns {Array} All results combined
 */
function fetchAllPages(url, token) {
  // Start with an empty list to collect the results in.
  var allResults = [];

  // Keep going as long as there is another page to fetch.
  while (url) {
    // Send the request to Canvas. The "Authorization" line shows Canvas the teacher's token so it
    // knows who is asking. "muteHttpExceptions" tells Google not to stop right away if Canvas
    // says no, so the check below can give a clearer message.
    var response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    // Canvas answers with a status number. 200 means "OK". Anything else (like 401, "not allowed",
    // when the token is wrong) stops everything with an error that includes the start of
    // Canvas's reply.
    var code = response.getResponseCode();
    if (code !== 200) {
      throw new Error('Canvas API returned ' + code + ': ' + response.getContentText().substring(0, 200));
    }

    // Canvas's reply is written in JSON (a standard way of writing data as plain text). Turn it
    // into a list the tool can use, add it to our collection, and look for the next page's
    // address. When there is no next page, the loop ends.
    var data = JSON.parse(response.getContentText());
    allResults = allResults.concat(data);
    url = getNextPageUrl(response);
  }

  // Hand back every result from every page as one list.
  return allResults;
}

// Find the web address of the next page of results, if there is one.
// Canvas tucks this address into each reply's "Link" header (headers are extra details sent
// along with a web reply, separate from the main content). It looks something like:
// <address of next page>; rel="next", <address of last page>; rel="last"
// It is given Canvas's reply and gives back the next page's address, or nothing (null) if
// this was the last page.
/**
 * Parses the Link header from a Canvas API response to find the next page URL.
 * Canvas uses RFC 5988 Link headers: <url>; rel="next", <url>; rel="last"
 * @param {HTTPResponse} response - The UrlFetchApp response object
 * @returns {string|null} The next page URL, or null if no more pages
 */
function getNextPageUrl(response) {
  // Read the reply's headers. The name may be written "Link" or "link", so check both.
  // No Link header at all means there is only one page.
  var headers = response.getHeaders();
  var linkHeader = headers['Link'] || headers['link'];
  if (!linkHeader) return null;

  // The header lists several addresses separated by commas. Look at each one, and if it is
  // labeled rel="next", strip off the < > brackets around it and hand back the address.
  var links = linkHeader.split(',');
  for (var i = 0; i < links.length; i++) {
    var parts = links[i].split(';');
    if (parts.length === 2 && parts[1].trim() === 'rel="next"') {
      return parts[0].trim().replace(/^<|>$/g, '');
    }
  }
  // No address was labeled "next", so this was the last page.
  return null;
}
