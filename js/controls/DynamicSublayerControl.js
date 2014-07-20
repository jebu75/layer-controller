/*
 * arcgis dynamic map service layer sublayer control
 */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/MenuSeparator',
    'dijit/form/CheckBox',
    'dojo/text!app/controls/templates/DynamicSublayerControl.html'
], function(
    declare,
    lang,
    arrayUtil,
    on,
    domClass,
    domStyle,
    domAttr,
    WidgetBase,
    TemplatedMixin,
    Menu,
    MenuItem,
    MenuSeparator,
    CheckBox,
    dynamicSublayerControlTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin], {
        //template
        templateString: dynamicSublayerControlTemplate,
        
        //options
        control: null,
        sublayerInfo: null,
        
        constructor: function(options) {
            options = options || {};
            lang.mixin(this, options);
        },
        
        postCreate: function() {
            //create the checkbox and init control
            this.checkbox = new CheckBox({
                checked: this.sublayerInfo.defaultVisibility,
                onChange: lang.hitch(this, function() {
                    this.control._setVisibleLayers();
                    this._checkboxScaleRange();
                })
            }, this.checkboxNode);
            
            //layer's label
            this.labelNode.innerHTML = this.sublayerInfo.name;
            
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
            
            //check scales and check on map 'zoom-end' if so
            if (this.sublayerInfo.minScale !== 0 || this.sublayerInfo.maxScale !== 0) {
                this._checkboxScaleRange();
                this.control.map.on('zoom-end', lang.hitch(this, this._checkboxScaleRange));
            }
            
            //element attribute and class for setVisibleLayers
            domAttr.set(this.checkbox.focusNode, 'data-layer-id', this.sublayerInfo.id);
            domClass.add(this.checkbox.focusNode, this.control.layer.id + '-layer-checkbox');
            
            //add custom menu items
            var items = this.control.layerParams.sublayerMenuItems;
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
                scale = this.control.map.getScale(),
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
            this.menu = new Menu({
                contextMenuForWindow: false,
                targetNodeIds: [this.labelNode],
                leftClickToOpen: true
            });
            arrayUtil.forEach(items, function (item) {
                if (item.separator && item.separator === 'separator') {
                    this.menu.addChild(new MenuSeparator());
                } else {
                    this.menu.addChild(new MenuItem(item));
                }
            }, this);
            this.menu.startup();
        }
    });
});
