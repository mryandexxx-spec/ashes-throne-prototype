"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path");
const css=fs.readFileSync(path.join(__dirname,"..","styles.css"),"utf8");
const js =fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");

// Verify squad choice styles are present
assert.match(css,/#squad \.squad-card/,"squad-card styles present");
assert.match(css,/#squad \.squad-card\.chosen/,"chosen state styles present");
assert.match(css,/#squad \.squad-card\.hero-locked:disabled/,"locked hero styles present");
assert.match(css,/#squad \.squad-slot-card/,"squad-slot-card styles present");
assert.match(css,/#squad \.squad-slot-card\.leader\.filled/,"leader filled slot styles present");
assert.match(css,/#squad \.squad-slot-card\.filled/,"filled slot styles present");

// Verify renderSquad references new class names
assert.match(js,/class="squad-card/,"renderSquad uses squad-card class");
assert.match(js,/class="squad-slot-card/,"renderSquad uses squad-slot-card class");
assert.match(js,/\$\{i===0\?"leader":""\}/,"slot leader class conditional present");
assert.match(js,/heroPortraitUrl/,"heroPortraitUrl helper referenced");
assert.match(js,/squadPower/,"squadPower helper referenced");

// Verify new DOM elements are queried
assert.match(js,/#squadPower/,"squadPower element queried");
assert.match(js,/#squadLeaderBar/,"squadLeaderBar element queried");
assert.match(js,/#squadLeaderText/,"squadLeaderText element queried");

// Verify slot click handler is attached
assert.match(js,/\.squad-slot-card\[data-slot-index\]/,"slot click selector present");
assert.match(js,/toggleSquadHero\(h\.id\)/,"slot click calls toggleSquadHero");

console.log("ui-hero-002-squad: all assertions passed");
