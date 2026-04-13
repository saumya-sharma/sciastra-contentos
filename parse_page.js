const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
for(let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<>')) stack.push(i + 1);
  if (lines[i].includes('</>')) {
      if (stack.length === 0) console.log("Missing open <> for end at line", i+1);
      else {
          const open = stack.pop();
          if (i+1 === 1862) console.log("Line 1862 closed <> opened at line", open);
      }
  }
}
if (stack.length > 0) console.log("Unmatched <> left over: ", stack);
