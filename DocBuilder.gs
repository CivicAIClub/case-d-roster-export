// DocBuilder.gs: builds the Google Docs where the teacher writes report comments.
// Code.gs gives it the grading period (like "Fall Midterm") and, for each class the teacher
// picked, the class name and its student list from Canvas (see CanvasAPI.gs).
// It makes a new folder in the teacher's Google Drive, then one Google Doc per class inside it.
// Each doc gets a separate space for every student: the student's name in bold, then a
// "Comment:" label with blank lines under it for the teacher to write in.
// It first tries to give each student their own tab (like tabs in a web browser, but inside
// the doc). If that doesn't work, it puts each student on their own page instead, in a fresh
// copy of the doc (the half-made tab version goes to the Drive trash).
// The links to the new folder and docs go back to Code.gs and are shown to the teacher.
// Later, DocReader.gs reads the finished comments back out of these same docs.
//
// Make the Drive folder and one comment doc per class.
// It is given the list of classes (each with its name and students) and the grading period.
// It gives back the folder's link and, for each class, the doc's name, link, and student count.
/**
 * Creates one Google Doc per class, with a tab for each student.
 * All docs are placed in a shared Google Drive folder.
 *
 * Structure:
 *   Drive Folder: "Comments — Fall Midterm"
 *     ├── Doc: "Hum 2 — Fall Midterm"
 *     │     ├── Tab: "Adams, John"      → blank comment area
 *     │     ├── Tab: "Baker, Sarah"     → blank comment area
 *     │     └── Tab: "Chen, Michael"    → blank comment area
 *     └── Doc: "Adv Writing — Fall Midterm"
 *           ├── Tab: "Garcia, Ana"      → blank comment area
 *           └── Tab: "Kim, David"       → blank comment area
 *
 * @param {Array} coursesData - [{name: "Course Name", students: [{name, id}]}]
 * @param {string} gradingPeriod - e.g., "Fall Midterm", "Winter Term"
 * @returns {Object} {folderUrl, docs: [{name, url, studentCount}]}
 */
function createAllCommentsDocs(coursesData, gradingPeriod) {
  // Create a new folder in the teacher's Google Drive named, for example,
  // "Comments — Fall Midterm".
  var folderName = 'Comments — ' + gradingPeriod;
  var folder = DriveApp.createFolder(folderName);

  // Go through the classes one at a time, build a doc for each (see createClassDoc_ below), and
  // keep each new doc's details.
  var docs = [];
  for (var i = 0; i < coursesData.length; i++) {
    var result = createClassDoc_(coursesData[i], gradingPeriod, folder);
    docs.push(result);
  }

  // Hand back the folder's link and the list of doc details.
  return {
    folderUrl: folder.getUrl(),
    docs: docs
  };
}

// Build the comment doc for one class.
// It is given the class (its name and students), the grading period, and the folder to put
// the doc in. It gives back the doc's name, its link, and how many students it has.
// (The "_" at the end of the name marks a behind-the-scenes helper. Apps Script won't let the
// pop-up windows call it directly.)
/**
 * Creates a single Google Doc for one class, with a tab per student.
 * Uses the advanced Google Docs API for tab creation.
 *
 * @param {Object} course - {name, students: [{name, id}]}
 * @param {string} gradingPeriod
 * @param {Folder} folder - Google Drive folder to place the doc in
 * @returns {Object} {name, url, studentCount}
 */
function createClassDoc_(course, gradingPeriod, folder) {
  // Name the doc after the class and grading period, for example "Hum 2 — Fall Midterm".
  var docTitle = course.name + ' — ' + gradingPeriod;

  // Create doc via advanced Docs API (gives us access to tab IDs)
  // This uses Google's more detailed "Docs API" (a way for programs to control Google Docs),
  // which is needed for working with tabs. The new doc starts out at the top level of the
  // teacher's Drive.
  var doc = Docs.Documents.create({ title: docTitle });
  var docId = doc.documentId;

  // Move to the shared folder
  // Find the new doc as a Drive file and move it into the comments folder.
  var file = DriveApp.getFileById(docId);
  file.moveTo(folder);

  // If the class has no students, leave the doc blank and hand back its details right away.
  if (course.students.length === 0) {
    return {
      name: course.name,
      url: 'https://docs.google.com/document/d/' + docId + '/edit',
      studentCount: 0
    };
  }

  // Try tab-based approach first, fall back to page-based if tabs aren't supported
  // If building with tabs fails for any reason, write a note in the script's log (a
  // behind-the-scenes record only developers look at) and build the doc with one page per
  // student instead.
  try {
    buildDocWithTabs_(docId, doc, course.students);
  } catch (tabError) {
    Logger.log('Tab creation not supported, falling back to pages: ' + tabError.message);
    // The tab attempt may have stopped halfway, leaving some tabs already made. So instead of
    // adding pages to that half-built doc, move it to the Drive trash (the teacher could still
    // restore it from there) and start over with a brand-new, empty doc of the same name.
    file.setTrashed(true);
    docId = DocumentApp.create(docTitle).getId();
    DriveApp.getFileById(docId).moveTo(folder);
    buildDocWithPages_(docId, course, gradingPeriod);
  }

  // Hand back the doc's name, its web link, and how many students are in it.
  return {
    name: course.name,
    url: 'https://docs.google.com/document/d/' + docId + '/edit',
    studentCount: course.students.length
  };
}

// ─────────────────────────────────────────────
// Primary: Tabs per student (Advanced Docs API)
// ─────────────────────────────────────────────

// Fill a doc with one tab per student, each tab named after the student.
// It is given the doc's ID, the doc as Google first described it, and the class's students
// (already in A-to-Z order). It gives nothing back; it changes the doc directly.
// It works in two rounds: first it creates and names all the tabs, then it writes the name
// heading and "Comment:" label inside each tab.
/**
 * Populates a doc with one tab per student using the advanced Docs API.
 * Each tab is titled with the student's name and contains a comment area.
 */
function buildDocWithTabs_(docId, doc, students) {
  // A brand-new doc already has one tab. Look up that tab's ID so we can rename it.
  var defaultTabId = doc.tabs[0].tabProperties.tabId;

  // Step 1: Rename default tab to first student, create tabs for the rest
  // Instead of changing the doc one step at a time, we make a list of all the changes we want
  // and send them to Google together in one batch. That's faster and keeps us within Google's
  // limits on how many requests we can make.
  var tabRequests = [];

  // First change: rename the doc's existing tab to the first student's name.
  // "updateDocumentTabProperties" and "addDocumentTab" (below) are the exact names Google's
  // Docs API documentation uses for renaming a tab and adding a new tab.
  tabRequests.push({
    updateDocumentTabProperties: {
      tabProperties: { tabId: defaultTabId, title: students[0].name },
      fields: 'title'
    }
  });

  // For every other student, add a new tab named after them, placed in A-to-Z order.
  for (var i = 1; i < students.length; i++) {
    tabRequests.push({
      addDocumentTab: {
        tabProperties: {
          title: students[i].name,
          index: i
        }
      }
    });
  }

  // Send all the tab changes to Google at once.
  Docs.Documents.batchUpdate({ requests: tabRequests }, docId);

  // Step 2: Re-read doc to get all tab IDs (new tabs have server-assigned IDs)
  // Google picks the ID for each new tab, so ask for a fresh copy of the doc to learn them.
  // "includeTabsContent: true" is needed here: without it, Google leaves out the list of tabs
  // and only sends back the first tab's contents.
  var updatedDoc = Docs.Documents.get(docId, { includeTabsContent: true });

  // Step 3: Insert content into each tab
  // Go through each tab, one at a time. The tab's title is the student's name.
  for (var j = 0; j < updatedDoc.tabs.length; j++) {
    var tab = updatedDoc.tabs[j];
    var tabId = tab.tabProperties.tabId;
    var studentName = tab.tabProperties.title;

    // Build this tab's list of changes: add the text, then style it.
    var contentRequests = [
      // Position 1 is the very start of the tab. Each new piece of text goes in at the start and
      // pushes earlier text down, so the "Comment:" part is added first and the name second; the
      // name ends up on top.
      // Insert the text (inserted in reverse order since index stays at 1)
      // "\n" means "start a new line". So the tab reads: name, a blank line, "Comment:", then
      // empty lines for the teacher to write on.
      {
        insertText: {
          text: '\n\nComment:\n\n\n',
          location: { index: 1, tabId: tabId }
        }
      },
      {
        insertText: {
          text: studentName,
          location: { index: 1, tabId: tabId }
        }
      },
      // Style the student name as a heading
      // The name runs from position 1 to 1 plus the length of the name. Make it bold, size 16.
      {
        updateTextStyle: {
          textStyle: {
            bold: true,
            fontSize: { magnitude: 16, unit: 'PT' }
          },
          range: {
            startIndex: 1,
            endIndex: 1 + studentName.length,
            tabId: tabId
          },
          fields: 'bold,fontSize'
        }
      },
      // Style "Comment:" label
      // Make the word "Comment:" bold, size 11, and gray. It starts 2 characters after the name
      // ends (after the two line breaks) and is 8 characters long.
      {
        updateTextStyle: {
          textStyle: {
            bold: true,
            fontSize: { magnitude: 11, unit: 'PT' },
            foregroundColor: {
              color: { rgbColor: { red: 0.4, green: 0.4, blue: 0.4 } }
            }
          },
          range: {
            startIndex: 1 + studentName.length + 2,
            endIndex: 1 + studentName.length + 2 + 8,
            tabId: tabId
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      }
    ];

    // Send this tab's changes to Google. This happens once per student.
    Docs.Documents.batchUpdate({ requests: contentRequests }, docId);
  }
}

// ─────────────────────────────────────────────
// Fallback: Page breaks per student (DocumentApp)
// ─────────────────────────────────────────────

// Backup plan: if tabs didn't work, put every student on their own page of one long doc.
// It is given the ID of a brand-new, empty doc (see createClassDoc_ above), the class (its name and students), and the grading period.
// It gives nothing back; it changes the doc directly.
// This uses Google's simpler, built-in way of editing docs ("DocumentApp").
/**
 * Fallback if the Docs API doesn't support tab creation.
 * Uses page breaks to give each student their own page within a single doc.
 */
function buildDocWithPages_(docId, course, gradingPeriod) {
  // Open the doc, get its main body of text, and set the font to Arial.
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();
  body.setFontFamily('Arial');

  // Doc title
  // At the top, add a gray title with the class name and grading period.
  var title = body.appendParagraph(course.name + ' — ' + gradingPeriod);
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.setFontSize(14);
  title.setBold(true);
  title.setForegroundColor('#888888');

  // Go through each student, one at a time.
  for (var i = 0; i < course.students.length; i++) {
    var student = course.students[i];

    // Page break between students (not before the first)
    // The first student goes right under the title, after a blank line. Everyone after that
    // starts on a new page.
    if (i > 0) {
      body.appendPageBreak();
    } else {
      body.appendParagraph('');
    }

    // Student name heading
    // Add the student's name as a bold heading. DocReader.gs later finds each student by looking
    // for this heading style ("Heading 2"), so it matters.
    var nameHeading = body.appendParagraph(student.name);
    nameHeading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    nameHeading.setFontSize(16);
    nameHeading.setBold(true);

    // Comment label
    // Add a blank line, then the gray, bold "Comment:" label.
    body.appendParagraph('');
    var label = body.appendParagraph('Comment:');
    label.setBold(true);
    label.setForegroundColor('#666666');
    label.setFontSize(11);

    // Blank space for writing
    // Add three empty lines where the teacher will type.
    body.appendParagraph('');
    body.appendParagraph('');
    body.appendParagraph('');
  }

  // Save the doc and close it so all the changes are stored.
  doc.saveAndClose();
}
