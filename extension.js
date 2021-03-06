
/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// focus-effects: Apply effects on window focus/blur

// Copyright (C) 2011 Florian Mounier aka paradoxxxzero

// This program is free software: you can redistribute it and/or m odify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Author: Florian Mounier aka paradoxxxzero

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const Slider = imports.ui.slider;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const Tweener = imports.ui.tweener;
const Lightbox = imports.ui.lightbox;
const Screenshot = imports.ui.screenshot;
const PopupMenu = imports.ui.popupMenu;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
let appsMenuButton;
let tracker, display, app_system, focus_connection, workspace_connection, animations;
let text, button;
let off = false;

function colorFromRGBA(rgba) {
  return new Clutter.Color({ red: rgba.red * 255,
                             green: rgba.green * 255,
                             blue: rgba.blue * 255,
                             alpha: rgba.alpha * 255 });
}

const FLASHSPOT_ANIMATION_OUT_TIME = 1; // seconds

const Flashspot = new Lang.Class({
  Name: 'Flashspot',
  Extends: Lightbox.Lightbox,
  _init: function(area, windowMeta) {
    this.parent(Main.uiGroup, { inhibitEvents: false,
                                width: area.width,
                                height: area.height });
    this.actor.style_class = 'focusflash';
    this.actor.set_position(area.x, area.y);
    this.app = tracker.get_window_app(windowMeta);
    let icon = this.app.create_icon_texture(512);
    /*let icon = new Gio.FileIcon({ file: Gio.File.new_for_path(
     Extension.dir.get_child('images/six600110.png').get_path())});
    this.indicatorBox = new St.BoxLayout;
    this.indicatorIcon =new St.Icon({ gicon: icon, icon_size: 256});
    this.indicatorBox.add_actor (this.indicatorIcon);
    this.actor.add_actor(this.indicatorBox);
    */
    //let icon = Clutter.texture_new_from_file({ file: Gio.File.new_for_path(
    // Extension.dir.get_child('images/six600110.png').get_path())});
    this.actor.add_actor(icon);
    this.pactor = windowMeta.get_compositor_private();
    this.actor.scale_center_x =  0.5;
    this.actor.scale_center_y =  0.5;
    this.actor.set_pivot_point(0.5, 0.5);
    //this.indicatorBox.set_pivot_point(0.5, 0.5);
    let constraint = Clutter.BindConstraint.new(this.pactor, Clutter.BindCoordinate.X, 0.0);
    this.actor.add_constraint_with_name("x-bind", constraint);
    constraint = Clutter.BindConstraint.new(this.pactor, Clutter.BindCoordinate.Y, 0.0);
    this.actor.add_constraint_with_name("y-bind", constraint);
    constraint = Clutter.BindConstraint.new(this.pactor, Clutter.BindCoordinate.SIZE, 0.0);
    this.actor.add_constraint_with_name("size-bind", constraint);
    /*Tweener.addTween(this.indicatorBox, {
     rotation_angle_z: 720,
     transition: 'linear',
     time: FLASHSPOT_ANIMATION_OUT_TIME,
     onComplete: function() {
       this.destroy();

     },
    });
    Tweener.addTween(icon, {
     scale_x: 16,
     scale_y: 16,
     transition: 'linear',
     time: FLASHSPOT_ANIMATION_OUT_TIME,
     onComplete: function() {
       this.destroy();

     },
    });*/
    let actor = this.actor;
     Tweener.addTween(this.actor, {
     opacity: 0,
     transition: 'ease',
     time: FLASHSPOT_ANIMATION_OUT_TIME,
     onComplete: function() {
       actor.destroy();
    }});
    let red = Math.random();// * 0.667 + 0.333;
    let green = Math.random();// * 0.667 + 0.333;
    let blue = Math.random();// * 0.667 + 0.333;
    this.actor.set_background_color(colorFromRGBA({ 'red': red,
     'green': green, 'blue': blue, 'alpha': 0.88 }));
  },
  fire: function() {
    this.actor.show();
    this.actor.opacity = 255;
  }
});

function update () {
  if (off) return;
  let running = app_system.get_running();
  for(var i = 0; i < running.length; i++) {
    let windows = running[i].get_windows();
    for(var j = 0; j < windows.length; j++) {
      if ((!display.focus_window) || (display.focus_window != windows[j])) {
        let actor = windows[j].get_compositor_private();
        if(actor) {
          actor.set_pivot_point(0.5, 0.5);
          Tweener.addTween(actor, animations.blur);
        }
      }
    }
  }
  if(display.focus_window) {
    let app = tracker.get_window_app(display.focus_window);
    let windows = app.get_windows();
    for (i = 0; i < windows.length; i++) {
      let actor = windows[i].get_compositor_private();
      if (windows[i] == display.focus_window) {
        let flashspot = new Flashspot({ x : actor.x, y : actor.y, width: actor.width, height: actor.height}, display.focus_window);
        flashspot.fire();
      }
      actor.set_pivot_point(0.5, 0.5);
      Tweener.addTween(actor, animations.focus);
    }
  }
}

function removeTweens(actor, prop) {
    //Tweener.removeTweens(actor, prop);
    Tweener.removeTweens(actor);
}

function draw_outline() {
    let cr = area.get_context();
}

function enable() {
    animations = null;
    let file;
    Main.notify('focus-effects enabling.');
    try {
        file = Shell.get_file_contents_utf8_sync('.ffxrc.json');
    } catch (e) {
        log('.ffxrc.json not found setting defaults');
    }
    if(file) {
        try {
            animations = JSON.parse(file);
            if(!animations.focus || !animations.blur) {
                throw {
                    message: 'Invalid json, must constain at least a focus and a blur property'
                };
            }
        } catch (e) {
            log('.ffxrc.json has errors setting defaults');
            animations = null;
            Main.notifyError('Failed to parse ffxrc', e.message);
        }
    }
    // Default animations
    animations = animations || {
        desaturate: true,
        focus: {
            opacity: 255,
            time: 2
        },
        blur: {
            opacity: 200,
            time: 2
        }
    };
    Shell._ffx = { animations: animations };
    update();
    focus_connection = tracker.connect('notify::focus-app', update);
    appsMenuButton = new ApplicationsButton();
    Main.panel.addToStatusArea('focus effects', appsMenuButton);
    //workspace_connection = global.window_manager.connect('switch-workspace', update);
}

const gIcon = new Gio.FileIcon({ file: Gio.File.new_for_path(
 Extension.dir.get_child('images/computer.png').get_path())});

const ApplicationsButton = new Lang.Class({
    Name: 'AppsMenu.ApplicationsButton',
    Extends: PanelMenu.Button,

    _init: function() {
        this.monitor = Main.layoutManager.primaryMonitor;
        this.parent(null, 'preferences-system-time-symbolic');
        //add icon
        this.indicatorBox = new St.BoxLayout;
        this.indicatorIcon =new St.Icon({ gicon: gIcon, icon_size: 16});

        this.indicatorBox.add_actor (this.indicatorIcon);
        this.actor.add_actor(this.indicatorBox);
        this._toggle = new PopupMenu.PopupSwitchMenuItem(_("Effects Enabled"), true, { style_class: 'popup-subtitle-menu-item' });
        this._toggle.connect('toggled', Lang.bind(this, this._onToggled));
        this.menu.addMenuItem(this._toggle);

        let opacity, green, blue, tmpOpacity, scalex, scaley, scalez, x, y;
        opacity = 0;
        green = 0;
        blue = 0;
        tmpOpacity = 0;
        scalex = 1;
        scaley = 1;
        scalez = 1;
        this._opacitySliderTitle = new PopupMenu.PopupMenuItem(_('Opacity '
         + 1), { reactive: false });
        this._opacitySlider =  new Slider.Slider(0);
        this._opacitySlider.connect("value-changed",
         Lang.bind(this, this._opacitySliderValueChanged, null));
        this._opacitySliderContainer = new PopupMenu.PopupBaseMenuItem({ activate: false });
        this._opacitySliderContainer.actor.add(this._opacitySlider.actor, { expand: true });
        this.menu.addMenuItem(this._opacitySliderTitle);
        this.menu.addMenuItem(this._opacitySliderContainer);
    },

    _onToggled: function(item) {
      if (item.state) {
        turn_on();
      } else {
        turn_off();
      }
    },

    _opacitySliderValueChanged: function(slider) {
      animations.blur.opacity = Math.round(255 * slider._value);
      this._opacitySliderTitle.label.set_text(_("Opacity " + animations.blur.opacity));
      update();
    },
});



function init() {
    tracker = Shell.WindowTracker.get_default();
    display = global.display;
    app_system = Shell.AppSystem.get_default();
}

function turn_off() {
  let running = app_system.get_running();
  for(var i = 0; i < running.length; i++) {
    let windows = running[i].get_windows();
    for(var j = 0; j < windows.length; j++) {
      let actor = windows[j].get_compositor_private();
      Tweener.addTween(actor, animations.focus);
    }
  }
  off = true;
}

function turn_on() {
  off = false;
}

function disable() {
    Main.notify('focus-effects disabling.');
    tracker.disconnect(focus_connection);
    /*global.window_manager.disconnect(workspace_connection);*/
    let running = app_system.get_running();
    for(var i = 0; i < running.length; i++) {
        let windows = running[i].get_windows();
        for(var j = 0; j < windows.length; j++) {
           let actor = windows[j].get_compositor_private();
           Tweener.addTween(actor, animations.focus);
        }
    }
    appsMenuButton.destroy();
}
