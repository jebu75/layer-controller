/*
 * arcgis image service layer loader and control
 */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_Contained',
    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/PopupMenuItem',
    'dijit/MenuSeparator',
    'dijit/TooltipDialog',
    'dijit/form/CheckBox',
    'dijit/form/HorizontalSlider',
    'dijit/form/HorizontalRuleLabels',
    'esri/layers/ArcGISImageServiceLayer',
    'esri/tasks/ProjectParameters',
    'esri/config',
    'dojo/text!app/controls/templates/LayerControl.html',
    //the css
    'xstyle/css!app/controls/css/LayerControl.css'
], function(
    declare,
    lang,
    arrayUtil,
    domClass,
    domStyle,
    domConst,
    WidgetBase,
    TemplatedMixin,
    Contained,
    Menu,
    MenuItem,
    PopupMenuItem,
    MenuSeparator,
    TooltipDialog,
    CheckBox,
    HorizontalSlider,
    HorizontalRuleLabels,
    ArcGISImageServiceLayer,
    ProjectParameters,
    esriConfig,
    layerControlTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin, Contained], {
        //template
        templateString: layerControlTemplate,
        
        //for reoredering
        _layerType: 'overlay',
        
        //options
        control: null,
        layerInfo: null,
        
        constructor: function(options) {
            options = options || {};
            lang.mixin(this, options);
            if (this.controller) {
                this.map = this.controller.map;
            }
        },
        
        postCreate: function() {
            //validate
            if (!this.layerParams) {
                console.log('ImageLayerControl error::layerParams option is required');
                this.destroy();
                return;
            }
            if (!this.map) {
                console.log('ImageLayerControl error::map option is required');
                this.destroy();
                return;
            }
            
            //go!
            this._initialize(this.layerParams, this.map);
        },
        
        //add layer and init control
        _initialize: function(layerParams, map) {
            //mixin defaults
            var lp = lang.mixin({
                label: 'Please add label option to layerParams',
                secured: false,
                token: null,
                visible: false,
                opacity: 1
            }, layerParams);
            this.layerParams = lp;
            
            //the layer
            this.layer = new ArcGISImageServiceLayer((lp.secured) ? lp.url + '?token=' + lp.token : lp.url, {
                id: lp.id || null,
                visible: lp.visible,
                opacity: lp.opacity,
                resampling: lp.resampling
            });
            
            //reset url if secured
            if (lp.secured) {
                this.layer.url = lp.url;
            }
            
            //add the layer
            map.addLayer(this.layer);
            
            //if a layer id wasn't provided add map generated id to layerParams
            if (!lp.id) {
                lp.id = this.layer.id;
            }
            
            //extend the layer with layerParams
            this.layer.layerParams = lp;
            
            //the layer visibility checkbox
            this.checkbox = new CheckBox({
                checked: lp.visible,
                onChange: lang.hitch(this, this._toggleLayer)
            }, this.checkboxNode);
            
            //layer label
            this.labelNode.innerHTML = lp.label;
            
            //show hide layer updating indicator
            this.layer.on('update-start', lang.hitch(this, function() {
                domStyle.set(this.layerUpdateNode, 'display', 'inline-block'); //font awesome display
            }));
            this.layer.on('update-end', lang.hitch(this, function() {
                domStyle.set(this.layerUpdateNode, 'display', 'none');
            }));
            
            //needs a loaded layer
            this.layer.on('load', lang.hitch(this, function() {
                //check scales and check on map 'zoom-in' if so
                if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                    this._checkboxScaleRange();
                    map.on('zoom-end', lang.hitch(this, this._checkboxScaleRange));
                }
            }));
            
            //initiate scale changing
            // NOT USED YET - need to create scale setting in menu
            this.layer.on('scale-range-change', lang.hitch(this, function() {
                if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                    this._checkboxScaleRange();
                    map.on('zoom-end', lang.hitch(this, this._checkboxScaleRange));
                } else {
                    this._checkboxScaleRange();
                }
            }));
            
            //create layer menu
            domClass.remove(this.expandIconNode, ['fa', 'fa-plus-square-o', 'layerControlToggleIcon']);
            domStyle.set(this.expandIconNode, 'cursor', 'default');
            domConst.destroy(this.expandNode);
            
            //need a loaded layer
            this.layer.on('load', lang.hitch(this, function() {
                this._layerMenu();
            }));
        },
        
        //create the layer control menu
        _layerMenu: function() {
            this.menu = new Menu({
                contextMenuForWindow: false,
                targetNodeIds: [this.labelNode],
                leftClickToOpen: true
            });
            var menu = this.menu,
                lp = this.layerParams,
                layer = this.layer,
                controller = this.controller;
            
            //add custom menu items
            var layerMenuItems = lp.layerMenuItems;
            if (layerMenuItems && layerMenuItems.length) {
                arrayUtil.forEach(layerMenuItems, function (item) {
                    if (item.separator && item.separator === 'separator') {
                        menu.addChild(new MenuSeparator());
                    } else {
                        menu.addChild(new MenuItem(item));
                    }
                }, this);
                menu.addChild(new MenuSeparator());
            }
            
            //add move up and down if in a controller and reorder = true
            if (controller && controller.reorder) {
                menu.addChild(new MenuItem({
                    label: 'Move Layer Up',
                    onClick: lang.hitch(this, function() {
                        controller._moveUp(this);
                    })
                }));
                menu.addChild(new MenuItem({
                    label: 'Move Layer Down',
                    onClick: lang.hitch(this, function() {
                        controller._moveDown(this);
                    })
                }));
                menu.addChild(new MenuSeparator());
            }
            
            //zoom to layer extent
            menu.addChild(new MenuItem({
                label: 'Zoom to Layer Extent',
                onClick: lang.hitch(this, function() {
                    this._zoomToLayer();
                })
            }));
            
            //opacity slider
            this.opacitySlider = new HorizontalSlider({
                id: lp.id + '_opacity_slider',
                value: lp.opacity || 1,
                minimum: 0,
                maximum: 1,
                discreteValues: 11,
                showButtons: false,
                onChange: lang.hitch(this, function(value) {
                    layer.setOpacity(value);
                })
            });
            var rule = new HorizontalRuleLabels({
                style: 'height:1em;font-size:75%;color:gray;'
            }, this.opacitySlider.bottomDecoration);
            rule.startup();
            var opacityTooltip = new TooltipDialog({
                style: 'width:200px;',
                content: this.opacitySlider
            });
            domStyle.set(opacityTooltip.connectorNode, 'display', 'none');
            menu.addChild(new PopupMenuItem({
                label: 'Layer Opacity',
                popup: opacityTooltip
            }));
            
            //and done
            menu.startup();
        },
        
        //toggle layer visibility
        _toggleLayer: function() {
            var l = this.layer;
            if (l.visible) {
                l.hide();
            } else {
                l.show();
            }
            if (l.minScale !== 0 || l.maxScale !== 0) {
                this._checkboxScaleRange();
            }
        },
        
        //check scales and add/remove disabled classes from checkbox
        _checkboxScaleRange: function() {
            var node = this.checkbox.domNode,
                checked = this.checkbox.checked,
                scale = this.controller.map.getScale(),
                min = this.layer.minScale,
                max = this.layer.maxScale,
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
        
        //zoom to layer
        _zoomToLayer: function() {
            var layer = this.layer,
                map = this.map;
            if (layer.spatialReference === map.spatialReference) {
                map.setExtent(layer.fullExtent, true);
            } else {
                if (esriConfig.defaults.geometryService) {
                    esriConfig.defaults.geometryService.project(lang.mixin(new ProjectParameters(), {geometries: [layer.fullExtent], outSR: map.spatialReference}), function(r) {
                        map.setExtent(r[0], true);
                    }, function(e) {
                        console.log(e);
                    });
                } else {
                    console.log('ImageLayerControl _zoomToLayer::esriConfig.defaults.geometryService is not set');
                }
            }
        }
    });
});
