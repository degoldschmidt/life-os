-- Life OS: export every note from the Apple Notes app as an HTML file.
-- How to use: open this file in Script Editor, press Run, and allow access to Notes when macOS asks.
-- The files appear in a folder called AppleNotesExport on your Desktop. Then upload them in Life OS under Import.
-- Notes that are locked with a password or that Notes can't read are skipped.

set exportFolder to (POSIX path of (path to desktop folder)) & "AppleNotesExport"
do shell script "mkdir -p " & quoted form of exportFolder

set counter to 0
tell application "Notes"
	repeat with theNote in every note
		set filePath to ""
		try
			set theTitle to name of theNote
			set theBody to body of theNote
			set counter to counter + 1
			set safeTitle to my sanitize(theTitle)
			set filePath to exportFolder & "/" & (text -5 thru -1 of ("00000" & counter)) & "-" & safeTitle & ".html"
			set fileRef to open for access (POSIX file filePath) with write permission
			set eof of fileRef to 0
			write theBody to fileRef as «class utf8»
			close access fileRef
		on error
			try
				close access (POSIX file filePath)
			end try
		end try
	end repeat
end tell

display dialog "Exported " & counter & " notes to " & exportFolder buttons {"OK"} default button "OK"

on sanitize(t)
	set cleaned to do shell script "printf %s " & quoted form of t & " | tr -cd '[:alnum:] _-' | cut -c1-60"
	if cleaned is "" then set cleaned to "note"
	return cleaned
end sanitize
