// Code.gs: the starting point and "traffic director" for the whole tool.
// This tool lives inside a Google Sheet. When the teacher opens the Sheet, this file adds two
// menus to the top bar: "Canvas Tools" and "Sundial Export".
// When the teacher picks a menu item, this file opens the matching pop-up window
// (TokenDialog.html, CourseSelector.html, SundialSetup.html, or ExportDialog.html) and then
// does the work that window asks for.
// It gets class lists from Canvas (the school's online class system) through CanvasAPI.gs and
// hands them to DocBuilder.gs, which makes Google Docs of comment templates in Google Drive.
// The later "Phase 2" step, sending finished comments into Sundial (the school's report
// system), uses DocReader.gs and SundialAPI.gs, and is not working yet.
//
// Google runs this automatically every time the teacher opens the Google Sheet.
// (A "function" is a named list of steps the tool can run. Some, like this one, Google runs
// on its own; others run when the teacher clicks a menu item or a button in a pop-up.)
// It adds the tool's two menus to the Sheet's top bar. It is given nothing and gives nothing back.
/**
 * Adds the "Canvas Tools" menu when the spreadsheet opens.
 */
function onOpen() {
  // Get hold of the Sheet's on-screen menus and pop-ups so we can add to them.
  var ui = SpreadsheetApp.getUi();

  // Build the "Canvas Tools" menu. Each item pairs the words the teacher sees with the name of
  // the function below that runs when they click it.
  ui.createMenu('Canvas Tools')
    .addItem('Set Canvas API Token', 'showTokenDialog')
    .addSeparator()
    .addItem('Generate Comments Template', 'showCourseSelector')
    .addToUi();

  // Build a second menu, "Sundial Export", for the Phase 2 steps that send finished comments
  // to Sundial. (These don't work yet; see SundialAPI.gs.)
  ui.createMenu('Sundial Export')
    .addItem('Connect to Sundial', 'showSundialSetup')
    .addSeparator()
    .addItem('Export Comments to Sundial', 'showExportDialog')
    .addToUi();
}

// Runs when the teacher clicks "Set Canvas API Token". Opens a small pop-up window (built from
// TokenDialog.html) where the teacher types in their school's Canvas web address and a token.
// A token is a long secret password that Canvas gives the teacher so this tool can log in to
// Canvas for them. This function is given nothing and gives nothing back.
/**
 * Opens the token setup dialog.
 */
function showTokenDialog() {
  // Load the pop-up's page from the TokenDialog.html file and set its size (in pixels).
  var html = HtmlService.createHtmlOutputFromFile('TokenDialog')
    .setWidth(450)
    .setHeight(280);
  // Show the pop-up on top of the Sheet. "Modal" means the teacher has to close it before they
  // can click anything else in the Sheet.
  SpreadsheetApp.getUi().showModalDialog(html, 'Canvas API Setup');
}

// Called by the TokenDialog pop-up when the teacher clicks save. It is given the teacher's
// Canvas token and the school's Canvas web address, and stores both so the tool remembers them
// next time. It gives nothing back.
/**
 * Saves the Canvas API token and base URL to user properties.
 */
function saveToken(token, baseUrl) {
  // "User properties" are a small private storage space Google keeps for each person using this
  // tool. Only this teacher can see what's saved there, so the secret token never goes in the code.
  var props = PropertiesService.getUserProperties();
  props.setProperty('CANVAS_TOKEN', token);
  // Save the web address with any "/" marks at the very end removed, so later we can add
  // "/api/v1/..." onto it without ending up with a double slash.
  props.setProperty('CANVAS_BASE_URL', baseUrl.replace(/\/+$/, ''));
}

// Runs when the teacher clicks "Generate Comments Template". It asks Canvas for the teacher's
// classes, then opens the pop-up (CourseSelector.html) where the teacher picks a grading
// period and which classes to make comment docs for. It is given nothing and gives nothing back.
/**
 * Fetches courses from Canvas and opens the course selector dialog.
 */
function showCourseSelector() {
  // Look up the Canvas token and web address the teacher saved earlier.
  var props = PropertiesService.getUserProperties();
  var token = props.getProperty('CANVAS_TOKEN');
  var baseUrl = props.getProperty('CANVAS_BASE_URL');

  // If either one is missing, the teacher hasn't set up Canvas yet. Show a message telling them
  // where to do that, and stop here.
  if (!token || !baseUrl) {
    SpreadsheetApp.getUi().alert(
      'Please set your Canvas API token first.\n\nGo to: Canvas Tools → Set Canvas API Token'
    );
    return;
  }

  // "try" means: attempt these steps, and if anything goes wrong (for example, Canvas is down or
  // the token is wrong), skip to the "catch" part at the bottom and show the problem instead.
  try {
    // Ask Canvas for every class this teacher is currently teaching (see CanvasAPI.gs).
    var courses = getCourses(baseUrl, token);
    // If Canvas found no classes, tell the teacher and stop, since there's nothing to pick from.
    if (courses.length === 0) {
      SpreadsheetApp.getUi().alert(
        'No active courses found.\n\nMake sure you are enrolled as a teacher in at least one Canvas course.'
      );
      return;
    }

    // Store courses temporarily for the dialog to read
    // The pop-up window runs separately from this code, so we can't hand it the list directly.
    // Instead we save the list as text, written in JSON (a standard way of writing data as plain
    // text), and the pop-up asks for it as soon as it opens (see getStoredCourses below).
    props.setProperty('TEMP_COURSES', JSON.stringify(courses));

    // Load the class-picker pop-up from CourseSelector.html, set its size, and show it.
    var html = HtmlService.createHtmlOutputFromFile('CourseSelector')
      .setWidth(500)
      .setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(html, 'Generate Comments Template');
  } catch (e) {
    // Something went wrong talking to Canvas (for example, a wrong or expired token). Show the
    // teacher Canvas's error message instead of failing silently.
    SpreadsheetApp.getUi().alert('Error fetching courses from Canvas:\n\n' + e.message);
  }
}

// Called by the class-picker pop-up as soon as it opens. It is given nothing, and it gives
// back the list of classes that showCourseSelector saved a moment ago (or an empty list if
// nothing was saved).
/**
 * Returns the temporarily stored courses list (called from CourseSelector dialog).
 */
function getStoredCourses() {
  // Read the saved text and turn it back into a list of classes. If nothing is there, hand back
  // an empty list.
  var json = PropertiesService.getUserProperties().getProperty('TEMP_COURSES');
  return json ? JSON.parse(json) : [];
}

// The main job of the tool. Called by the class-picker pop-up when the teacher clicks
// "Generate Templates". It is given the ID numbers of the classes the teacher ticked and the
// grading period they chose (like "Fall Midterm"). For each class it gets the student list
// from Canvas, then has DocBuilder.gs make one Google Doc per class inside a new Drive folder.
// It gives back the folder's link plus each new doc's name, link, and number of students,
// which the pop-up then shows to the teacher.
/**
 * Main function: fetches rosters and creates the Google Doc template.
 * Called from the CourseSelector dialog.
 */
function generateTemplate(selectedCourseIds, gradingPeriod) {
  // Look up the saved Canvas login details and the list of classes saved for the pop-up.
  var props = PropertiesService.getUserProperties();
  var token = props.getProperty('CANVAS_TOKEN');
  var baseUrl = props.getProperty('CANVAS_BASE_URL');
  var storedCourses = props.getProperty('TEMP_COURSES');

  // If the saved class list is missing (for example, this pop-up was left open from long ago),
  // stop with a message that tells the teacher exactly what to do, instead of a confusing error.
  if (!storedCourses) {
    throw new Error(
      'The class list for this window is no longer available. Please close this window and ' +
      'choose Canvas Tools → Generate Comments Template again.'
    );
  }
  // Turn the saved text back into a list of classes.
  var courses = JSON.parse(storedCourses);

  // Filter to only selected courses
  // Keep only the classes whose ID number is on the teacher's ticked list. The pop-up sends the
  // IDs as text, so each class's ID is turned into text too before comparing.
  var selectedCourses = courses.filter(function (c) {
    return selectedCourseIds.indexOf(String(c.id)) > -1;
  });

  // Fetch roster for each selected course
  // Go through the chosen classes one at a time. For each one, ask Canvas for its students (see
  // getRoster in CanvasAPI.gs) and set aside the class name together with its student list.
  var coursesData = [];
  for (var i = 0; i < selectedCourses.length; i++) {
    var course = selectedCourses[i];
    var students = getRoster(baseUrl, token, course.id);
    coursesData.push({
      name: course.name,
      students: students
    });
  }

  // Create one Google Doc per class (tabs per student), all in a Drive folder
  // DocBuilder.gs does the actual building and hands back the folder link and the new docs.
  var result = createAllCommentsDocs(coursesData, gradingPeriod);

  // Store the folder URL for the Sundial export dialog
  // Remember where this comments folder is, so the Sundial export window can offer to fill in
  // its link later.
  props.setProperty('LAST_COMMENTS_FOLDER', result.folderUrl);

  // Keep the saved class list (don't delete it) so the teacher can tick more classes in the same
  // pop-up and click "Generate Templates" again. It isn't secret, and it gets replaced with a
  // fresh list the next time the teacher opens this pop-up from the menu.

  // Hand the results back to the pop-up so it can show links to the new docs.
  return result;
}

// Called by the Sundial export pop-up (ExportDialog.html). It is given nothing and gives back
// the link to the most recent comments folder this teacher made, or empty text if there is none.
/**
 * Returns the last generated comments folder URL (for export dialog).
 */
function getLastCommentsFolder() {
  return PropertiesService.getUserProperties().getProperty('LAST_COMMENTS_FOLDER') || '';
}

// ─────────────────────────────────────────────
// Sundial Export Functions
// ─────────────────────────────────────────────

// The functions below are for Phase 2: sending the teacher's finished comments into Sundial,
// the school's report system. Phase 2 is on hold until school IT turns on access to Sundial's
// API (a way for programs, not people, to talk to Sundial), so these steps don't fully work yet.
//
// Runs when the teacher clicks "Connect to Sundial". Opens the pop-up from SundialSetup.html
// where the teacher can type in the Sundial access codes. It is given nothing and gives
// nothing back.
/**
 * Opens the Sundial connection/setup dialog.
 */
function showSundialSetup() {
  // Load the setup pop-up from SundialSetup.html, set its size, and show it.
  var html = HtmlService.createHtmlOutputFromFile('SundialSetup')
    .setWidth(480)
    .setHeight(450);
  SpreadsheetApp.getUi().showModalDialog(html, 'Connect to Sundial');
}

// Runs when the teacher clicks "Export Comments to Sundial". First it checks whether the tool
// is connected to Sundial. If not, it shows a message and stops. If it is, it opens the export
// pop-up (ExportDialog.html). It is given nothing and gives nothing back.
// Note: right now the connection check in SundialAPI.gs always answers "not connected", so for
// now this always shows the message and the export pop-up never opens.
/**
 * Opens the export dialog for pushing comments to Sundial.
 */
function showExportDialog() {
  // Ask SundialAPI.gs whether we have a working connection to Sundial.
  var status = checkSundialConnection();
  // Not connected: explain why, point the teacher to the setup menu item, and stop.
  if (!status.connected) {
    SpreadsheetApp.getUi().alert(
      'Not connected to Sundial.\n\n' + status.message +
      '\n\nGo to: Sundial Export → Connect to Sundial'
    );
    return;
  }

  // Connected: load the export pop-up from ExportDialog.html, set its size, and show it.
  var html = HtmlService.createHtmlOutputFromFile('ExportDialog')
    .setWidth(500)
    .setHeight(550);
  SpreadsheetApp.getUi().showModalDialog(html, 'Export Comments to Sundial');
}

// Called by the export pop-up when the teacher clicks "Export All to Sundial". It is given the
// link to the Drive folder of comment docs. (The technical notes below call it "docUrl", but it
// is really a folder link.) The plan is to read every comment out of those docs, send each one
// into Sundial, and give back how many worked, how many failed, and why.
// For now only the reading works: it reads the docs, then stops with a message saying how much
// it read and that it is waiting on school IT.
/**
 * Main export function: reads comments from Google Doc and pushes to Sundial.
 * Called from ExportDialog.html.
 *
 * TODO: Implement once Sundial API endpoints are confirmed.
 *
 * @param {string} docUrl - URL of the completed comments Google Doc
 * @returns {Object} {success: number, failed: number, errors: []}
 */
function exportCommentsToSundial(folderUrl) {
  // Step 1: Read comments from all docs in the folder
  // DocReader.gs opens each doc in the folder and gives back, for each class, its name, grading
  // period, and every student's name and comment.
  var allSections = readCommentsFromFolder(folderUrl);

  // The greyed-out lines below (each starting with "//") are the planned steps, switched off
  // until Sundial access exists. The plan: for each class, find the matching class in Sundial,
  // get Sundial's student list for it, match students by name, then send each comment.
  // Step 2: For each class/section, match students to Sundial and push comments
  // TODO: Implement once Sundial API is available
  //
  // var allResults = { success: 0, failed: 0, errors: [] };
  // for (var i = 0; i < allSections.length; i++) {
  //   var section = allSections[i];
  //   var sundialSections = getSundialSections();
  //   var matched = sundialSections.find(s => s.course_name === section.courseName);
  //   if (!matched) {
  //     allResults.errors.push('Could not find Sundial section for: ' + section.courseName);
  //     continue;
  //   }
  //   var sundialRoster = getSundialRoster(matched.section_id);
  //   var matchedStudents = matchStudentsToSundial(section.students, sundialRoster);
  //   var result = pushAllCommentsForSection(matched.section_id, matchedStudents, matched.term);
  //   allResults.success += result.success;
  //   allResults.failed += result.failed;
  //   allResults.errors = allResults.errors.concat(result.errors);
  // }
  // return allResults;

  // Count how many students were read across all the classes, for the message below.
  var totalStudents = allSections.reduce(function (sum, s) { return sum + s.students.length; }, 0);
  // Stop here on purpose and report a message instead of a result. The export pop-up shows
  // this message to the teacher as an error.
  throw new Error(
    'Sundial export is not yet implemented.\n\n' +
    'Successfully read ' + allSections.length + ' class docs (' + totalStudents + ' students total).\n' +
    'Waiting for school admin to enable SKY API access.'
  );
}
