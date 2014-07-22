/*
 * web tiled layer loader and control
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
    'esri/layers/WebTiledLayer',
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
    WebTiledLayer,
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
                console.log('WebTiledLayerControl error::layerParams option is required');
                this.destroy();
                return;
            }
            if (!this.map) {
                console.log('WebTiledLayerControl error::map option is required');
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
                visible: false,
                opacity: 1,
                subDomains: [],
                copyright: '',
                resampling: true
            }, layerParams);
            this.layerParams = lp;
            
            //the layer
            this.layer = new WebTiledLayer(lp.urlTemplate, {
                visible: lp.visible,
                opacity: lp.opacity,
                subDomains: lp.subDomains,
                copyright: lp.copyright,
                resampling: lp.resampling
            });
            
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
            
            //create layer menu
            domClass.remove(this.expandIconNode, ['fa', 'fa-plus-square-o', 'layerControlToggleIcon']);
            domStyle.set(this.expandIconNode, 'cursor', 'default');
            domConst.destroy(this.expandNode);
            this._layerMenu();
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
                    console.log('WebTiledLayerControl _zoomToLayer::esriConfig.defaults.geometryService is not set');
                }
            }
        }
    });
});
