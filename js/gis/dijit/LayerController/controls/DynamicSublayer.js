define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dojo/html',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/MenuSeparator',
    'dijit/form/CheckBox',
    'dojo/text!gis/dijit/LayerController/controls/templates/Sublayer.html'
], function(
    declare,
    lang,
    arrayUtil,
    on,
    domClass,
    domStyle,
    domAttr,
    html,
    WidgetBase,
    TemplatedMixin,
    Menu,
    MenuItem,
    MenuSeparator,
    CheckBox,
    sublayerTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin], {
        templateString: sublayerTemplate,
        //options
        control: null,
        sublayer: null,
        constructor: function(options) {
            options = options || {};
            lang.mixin(this, options);
        },
        postCreate: function() {
            this.checkbox = new CheckBox({
                checked: this.sublayerInfo.defaultVisibility,
                onChange: lang.hitch(this, function() {
                    this.control._setVisibleLayers();
                    this._checkboxScaleRange();
                })
            }, this.checkboxNode);
            html.set(this.labelNode, this.sublayerInfo.name);
            //toggle expandNode
            on(this.expandClickNode, 'click', lang.hitch(this, function() {
                var expandNode = this.expandNode,
                    iconNode = this.expandIconNode;
                if (domStyle.get(expandNode, 'display') === 'none') {
                    domStyle.set(expandNode, 'display', 'block');
                    domClass.remove(iconNode, 'fa-plus-square-o');
                    domClass.add(iconNode, 'fa-minus-square-o');
                } else {
                    domStyle.set(expandNode, 'display', 'none');
                    domClass.remove(iconNode, 'fa-minus-square-o');
                    domClass.add(iconNode, 'fa-plus-square-o');
                }
            }));
            if (this.sublayerInfo.minScale !== 0 || this.sublayerInfo.maxScale !== 0) {
                this._checkboxScaleRange();
                this.control.layer.getMap().on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
            }
            domAttr.set(this.checkbox.focusNode, 'data-layer-id', this.sublayerInfo.id);
            domClass.add(this.checkbox.focusNode, this.control.layer.id + '-layer-checkbox');
            //add custom menu items
            var items = this.control.params.controlOptions.sublayerMenuItems;
            if (items && items.length) {
                this._sublayerMenu(items);
            } else {
                domClass.remove(this.labelNode, 'layerControlClick');
            }
        },
        //check scales and add/remove disabled classes from checkbox
        _checkboxScaleRange: function() {
            var node = this.checkbox.domNode,
                checked = this.checkbox.checked,
                scale = this.control.layer.getMap().getScale(),
                min = this.sublayerInfo.minScale,
                max = this.sublayerInfo.maxScale,
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
        },
        //create menu
        _sublayerMenu: function(items) {
            this._menu = new Menu({
                contextMenuForWindow: false,
                targetNodeIds: [this.labelNode],
                leftClickToOpen: true
            });
            arrayUtil.forEach(items, function (item) {
                if (item.separator && item.separator === 'separator') {
                    this._menu.addChild(new MenuSeparator());
                } else {
                    this._menu.addChild(new MenuItem(item));
                }
            }, this);
            this._menu.startup();
        }
    });
});
