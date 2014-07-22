define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dojo/html',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/form/CheckBox',
    'dojo/text!gis/dijit/LayerController/controls/templates/Folder.html'
], function(
    declare,
    lang,
    on,
    domClass,
    domStyle,
    domAttr,
    html,
    WidgetBase,
    TemplatedMixin,
    CheckBox,
    folderTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin], {
        templateString: folderTemplate,
        
        //options
        control: null,
        folderInfo: null,
        
        constructor: function(options) {
            options = options || {};
            lang.mixin(this, options);
        },
        
        postCreate: function() {
            this.checkbox = new CheckBox({
                checked: this.folderInfo.defaultVisibility,
                onChange: lang.hitch(this, function() {
                    this.control._setVisibleLayers();
                    this._checkboxScaleRange();
                })
            }, this.checkboxNode);
            
            html.set(this.labelNode, this.folderInfo.name);
            
            on(this.expandClickNode, 'click', lang.hitch(this, function() {
                var expandNode = this.expandNode,
                    iconNode = this.expandIconNode;
                if (domStyle.get(expandNode, 'display') === 'none') {
                    domStyle.set(expandNode, 'display', 'block');
                    domClass.remove(iconNode, 'fa-folder-o');
                    domClass.add(iconNode, 'fa-folder-open-o');
                } else {
                    domStyle.set(expandNode, 'display', 'none');
                    domClass.remove(iconNode, 'fa-folder-open-o');
                    domClass.add(iconNode, 'fa-folder-o');
                }
            }));
            
            if (this.folderInfo.minScale !== 0 || this.folderInfo.maxScale !== 0) {
                this._checkboxScaleRange();
                this.control.layer.getMap().on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
            }
            
            domAttr.set(this.checkbox.focusNode, 'data-layer-id', this.folderInfo.id);
            domClass.add(this.checkbox.focusNode, this.control.layer.id + '-layer-checkbox');
        },
        
        //check scales and add/remove disabled classes from checkbox
        _checkboxScaleRange: function() {
            var node = this.checkbox.domNode,
                checked = this.checkbox.checked,
                scale = this.control.layer.getMap().getScale(),
                min = this.folderInfo.minScale,
                max = this.folderInfo.maxScale,
                x = 'dijitCheckBoxDisabled',
                y = 'dijitCheckBoxCheckedDisabled';
            domClass.remove(node, [x, y]);
            if (min !== 0 && scale > min) {
                if (checked) {
                    domClass.add(node, y);
                } else {
                    domClass.add(node, x);
                }
            }
            if (max !== 0 && scale < max) {
                if (checked) {
                    domClass.add(node, y);
                } else {
                    domClass.add(node, x);
                }
            }
        }
    });
});
