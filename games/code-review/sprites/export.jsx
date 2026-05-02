// =============================================================
// SUBJECT FILL & EXPORT AUTOMATION (V3 - With Ignore & Hex)
// =============================================================

function main() {
  if (app.documents.length === 0) {
    alert("Please open a document first.");
    return;
  }

  var doc = app.activeDocument;

  // 1. INPUT HEX COLOR
  var hexInput = prompt("Enter Hex Color (e.g., FF0000 for Red):", "FF0000");
  if (hexInput == null) return;

  var fillCol = new SolidColor();
  fillCol.rgb.hexValue = hexInput;

  // 2. CHOOSE DESTINATION
  var exportFolder = Folder.selectDialog("Select export folder");
  if (exportFolder == null) return;

  // 3. PROCESS LAYERS
  var layers = doc.artLayers;

  // Hide all first
  for (var j = 0; j < layers.length; j++) {
    layers[j].visible = false;
  }

  for (var i = 0; i < layers.length; i++) {
    var currentLayer = layers[i];

    // --- THE "IGNORE" LOGIC ---
    // Checks if the name is exactly "ignore" (case insensitive)
    if (
      currentLayer.name.toLowerCase() === "ignore" ||
      currentLayer.isBackgroundLayer
    ) {
      continue;
    }

    currentLayer.visible = true;
    doc.activeLayer = currentLayer;

    try {
      // A. SELECT SUBJECT
      var idautoCutout = stringIDToTypeID("autoCutout");
      var desc1 = new ActionDescriptor();
      desc1.putBoolean(stringIDToTypeID("sampleAllLayers"), false);
      executeAction(idautoCutout, desc1, DialogModes.NO);

      // B. FILL
      doc.selection.fill(fillCol);
      doc.selection.deselect();

      // C. EXPORT
      var safeName = currentLayer.name.replace(/[:\\\/\|?*<>\s]/g, "_");
      var saveFile = new File(exportFolder + "/" + safeName + ".png");

      var exportOptions = new ExportOptionsSaveForWeb();
      exportOptions.format = SaveDocumentType.PNG;
      exportOptions.PNG8 = false;
      exportOptions.transparency = true;
      exportOptions.quality = 100;

      doc.exportDocument(saveFile, ExportType.SAVEFORWEB, exportOptions);
    } catch (e) {
      $.writeln("Skipped: " + currentLayer.name);
    }

    currentLayer.visible = false; // Hide again
  }

  alert("Batch Complete!");
}

main();
