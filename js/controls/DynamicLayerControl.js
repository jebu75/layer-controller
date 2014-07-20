/*
 * arcgis dynamic map service layer loader and control
 */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/query',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/dom-attr',
    'dijit/registry',
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
    'esri/layers/ImageParameters',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/request',
    'esri/tasks/ProjectParameters',
    'esri/config',
    'app/controls/DynamicSublayerControl',
    'app/controls/DynamicFolderControl',
    'dojo/text!app/controls/templates/LayerControl.html',
    //the css
    'xstyle/css!app/controls/css/LayerControl.css'
], function(
    declare,
    lang,
    arrayUtil,
    on,
    query,
    domClass,
    domStyle,
    domConst,
    domAttr,
    registry,
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
    ImageParameters,
    ArcGISDynamicMapServiceLayer,
    esriRequest,
    ProjectParameters,
    esriConfig,
    SublayerControl,
    FolderControl,
    layerControlTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin, Contained], {
        //template
        templateString: layerControlTemplate,
        
        //for reoredering
        _layerType: 'overlay',
        
        //options
        controller: null,
        map: null,
        layerParams: null,
        
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
                console.log('DynamicLayerControl error::layerParams option is required');
                this.destroy();
                return;
            }
            if (!this.map) {
                console.log('DynamicLayerControl error::map option is required');
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
                opacity: 1,
                imageFormat: 'png32',
                dpi: 96,
                sublayers: true
            }, layerParams);
            this.layerParams = lp;
            
            //the layer
            this.layer = new ArcGISDynamicMapServiceLayer((lp.secured) ? lp.url + '?token=' + lp.token : lp.url, {
                id: lp.id || null,
                imageParameters: lang.mixin(new ImageParameters(), {format: lp.imageFormat, dpi: lp.dpi}),
                visible: lp.visible,
                opacity: lp.opacity
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
            
            //create sublayers or destroy expandNode and expand toggle icon
            //either way create layer menu
            if (lp.sublayers) {
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
                
                //need a loaded layer
                this.layer.on('load', lang.hitch(this, function() {
                    this._layerMenu();
                    this._sublayers();
                }));
            } else {
                domClass.remove(this.expandIconNode, ['fa', 'fa-plus-square-o', 'layerControlToggleIcon']);
                domStyle.set(this.expandIconNode, 'cursor', 'default');
                domConst.destroy(this.expandNode);
                
                //need a loaded layer
                this.layer.on('load', lang.hitch(this, function() {
                    this._layerMenu();
                }));
            }
        },
        
        //add folder/sublayer controls per layer.layerInfos
        _sublayers: function() {
            //check for single layer
            //if so no sublayer/folder controls
            if (this.layer.layerInfos.length > 1) {
                arrayUtil.forEach(this.layer.layerInfos, lang.hitch(this, function(info) {
                    var pid = info.parentLayerId,
                        slids = info.subLayerIds,
                        controlId = this.layer.id + '-' + info.id + '-sublayer-control',
                        control;
                    if (pid === -1 && slids === null) {
                        //it's a top level sublayer
                        control = new SublayerControl({
                            id: controlId,
                            control: this,
                            sublayerInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, this.expandNode, 'last');
                    } else if (pid === -1 && slids !== null) {
                        //it's a top level folder
                        control = new FolderControl({
                            id: controlId,
                            control: this,
                            folderInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, this.expandNode, 'last');
                    } else if (pid !== -1 && slids !== null) {
                        //it's a nested folder
                        control = new FolderControl({
                            id: controlId,
                            control: this,
                            folderInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, registry.byId(this.layer.id + '-' + info.parentLayerId + '-sublayer-control').expandNode, 'last');
                    } else if (pid !== -1 && slids === null) {
                        //it's a nested sublayer
                        control = new SublayerControl({
                            id: controlId,
                            control: this,
                            sublayerInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, registry.byId(this.layer.id + '-' + info.parentLayerId + '-sublayer-control').expandNode, 'last');
                    }
                }));
            }
            
            //check ags version and create legends
            if (this.layer.version >= 10.01) {
                this._legend();
            }
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
            
            //check for single layer and if so add sublayerMenuItems
            var sublayerMenuItems = lp.sublayerMenuItems;
            if (layer.layerInfos.length === 1 && sublayerMenuItems && sublayerMenuItems.length) {
                arrayUtil.forEach(sublayerMenuItems, function (item) {
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
                    arrayUtil.forEach(query('.' + lp.id + '-legend-image'), function(img) {
                        domStyle.set(img, 'opacity', value);
                    });
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
        
        //create legends for each sublayer and place in sublayer control's expand node
        _legend: function() {
            //get legend json
            esriRequest({
                url: this.layer.url + '/legend',
                callbackParamName: 'callback',
                content: {
                    f: 'json',
                    token: (typeof this.layer._getToken === 'function') ? this.layer._getToken() : null
                }
            }).then(lang.hitch(this, function(r) {
                //build table of legends for each sublayer
                arrayUtil.forEach(r.layers, function(layer) {
                    var legendContent = '<table class="' + this.layer.id + '-' + layer.layerId + '-legend layerControlLegendTable">';
                    arrayUtil.forEach(layer.legend, function(legend) {
                        var label = legend.label || '&nbsp;';
                        legendContent += '<tr><td><img class="' + this.layer.id + '-legend-image layerControlLegendImage" style="width:' + legend.width + ';height:' + legend.height + ';" src="data:' + legend.contentType + ';base64,' + legend.imageData + '" alt="' + label + '" /></td><td class="hardcider-layer-legend-label">' + label + '</td></tr>';
                    }, this);
                    legendContent += '</table>';
                    
                    //check for single layer
                    //if so use expandNode for legend
                    if (this.layer.layerInfos.length > 1) {
                        registry.byId(this.layer.id + '-' + layer.layerId + '-sublayer-control').expandNode.innerHTML = legendContent;
                    } else {
                        this.expandNode.innerHTML = legendContent;
                    }
                }, this);
                
                //set opacity per layer.opacity
                arrayUtil.forEach(query('.' + this.layer.id + '-legend-image'), function(img) {
                    domStyle.set(img, 'opacity', this.layer.opacity);
                }, this);
            }), lang.hitch(this, function(e) {
                console.log(e);
                console.log('DynamicLayerControl::an error occurred retrieving legend');
                if (this.layer.layerInfos.length === 1) {
                    this.expandNode.innerHTML = 'No Legend';
                }
            }));  
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
        
        //set dynamic layer visible layers
        _setVisibleLayers: function() {
            //because ags doesn't respect a layer group's visibility
            //i.e. layer 3 (the group) is off but it's sublayers still show
            //we need to check and if it's off also remove it's sublayers
            var setLayers = [];
            arrayUtil.forEach(query('.' + this.layer.id + '-layer-checkbox'), function(i) {
                if (i.checked) {
                    setLayers.push(parseInt(domAttr.get(i, 'data-layer-id'), 10));
                }
            }, this);
            arrayUtil.forEach(this.layer.layerInfos, function(info) {
                if (info.subLayerIds !== null && arrayUtil.indexOf(setLayers, info.id) === -1) {
                    arrayUtil.forEach(info.subLayerIds, function(sub) {
                        if (arrayUtil.indexOf(setLayers, sub) !== -1) {
                            setLayers.splice(arrayUtil.indexOf(setLayers, sub), 1);
                        }
                    });
                } else if (info.subLayerIds !== null && arrayUtil.indexOf(setLayers, info.id) !== -1) {
                    setLayers.splice(arrayUtil.indexOf(setLayers, info.id), 1);
                }
            }, this);
            if (setLayers.length) {
                this.layer.setVisibleLayers(setLayers);
                this.layer.refresh();
            } else {
                this.layer.setVisibleLayers([-1]);
                this.layer.refresh();
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
                    console.log('DynamicLayerControl _zoomToLayer::esriConfig.defaults.geometryService is not set');
                }
            }
        }
    });
});
