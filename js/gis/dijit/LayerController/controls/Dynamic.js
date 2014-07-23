/* ags dynamic control */
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
    'dojo/html',
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
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/request',
    'gis/dijit/LayerController/controls/DynamicSublayer',
    'gis/dijit/LayerController/controls/DynamicFolder',
    'dojo/text!gis/dijit/LayerController/controls/templates/Control.html'
], function (
    declare,
    lang,
    arrayUtil,
    on,
    query,
    domClass,
    domStyle,
    domConst,
    domAttr,
    html,
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
    ArcGISDynamicMapServiceLayer,
    esriRequest,
    DynamicSublayer,
    DynamicFolder,
    controlTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin, Contained], {
        templateString: controlTemplate,
        
        //for reoredering
        _layerType: 'overlay',
        
        //options
        controller: null,
        params: null,
        
        constructor: function(options) {
            options = options || {};
            lang.mixin(this, options);
        },
        
        postCreate: function() {
            if (!this.params) {
                console.log('Dynamic error::params option is required');
                this.destroy();
                return;
            }
            if (!this.params.url) {
                console.log('Dynamic error::params.url option is required');
                this.destroy();
                return;
            }
            if (!this.controller) {
                console.log('Dynamic error::controller option is required');
                this.destroy();
                return;
            }
            this._initialize(this.params, this.controller.map);
        },
        
        //add layer and init control
        _initialize: function(params, map) {
            if (params.layer && layer.isInstanceOf('esri.layers.ArcGISDynamicMapServiceLayer')) {
                this.layer = params.layer;
            } else if (params.layerOptions) {
                var layerOptions = params.layerOptions,
                    token = params.token || null;
                
                this.layer = new ArcGISDynamicMapServiceLayer((token) ? params.url + '?token=' + token : params.url, layerOptions);
                
                //reset url if secured
                if (token) {
                    this.layer.url = params.url;
                }
                
                map.addLayer(this.layer);
            } else {
                console.log('Dynamic error::a valid dynamic layer or layerOptions are required');
                html.set(this.labelNode, (params.title || 'Unknown Layer') + ': Invalid Layer');
                return;
            }
            
            lang.mixin(this.layer, params.layerExtend || {});
            
            this.checkbox = new CheckBox({
                checked: layerOptions.visible,
                onChange: lang.hitch(this, '_toggleLayer')
            }, this.checkboxNode);
            
            html.set(this.labelNode, params.title || 'Unknown Layer');
            
            this.layer.on('update-start', lang.hitch(this, function() {
                domStyle.set(this.layerUpdateNode, 'display', 'inline-block'); //font awesome display
            }));
            this.layer.on('update-end', lang.hitch(this, function() {
                domStyle.set(this.layerUpdateNode, 'display', 'none');
            }));
            
            var sublayers = params.controlOptions.sublayers || true;
            if (sublayers) {
                on(this.expandClickNode, 'click', lang.hitch(this, function() {
                    var expandNode = this.expandNode,
                        iconNode = this.expandIconNode;
                    if (domStyle.get(expandNode, 'display') === 'none') {
                        domStyle.set(expandNode, 'display', 'block');
                        domClass.replace(iconNode, 'fa-minus-square-o', 'fa-plus-square-o');
                    } else {
                        domStyle.set(expandNode, 'display', 'none');
                        domClass.replace(iconNode, 'fa-plus-square-o', 'fa-minus-square-o');
                    }
                }));
                this.layer.on('load', lang.hitch(this, function() {
                    this._layerMenu();
                    
                    this._sublayers();
                    
                    if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                        this._checkboxScaleRange();
                        map.on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
                    }
                }));
            } else {
                domClass.remove(this.expandIconNode, ['fa', 'fa-plus-square-o', 'layerControlToggleIcon']);
                domStyle.set(this.expandIconNode, 'cursor', 'default');
                domConst.destroy(this.expandNode);
                this.layer.on('load', lang.hitch(this, function() {
                    this._layerMenu();
                    
                    if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                        this._checkboxScaleRange();
                        map.on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
                    }
                }));
            }
            
            this.layer.on('scale-range-change', lang.hitch(this, function() {
                if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                    this._checkboxScaleRange();
                    map.on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
                } else {
                    this._checkboxScaleRange();
                }
            }));
            
            var minScale = params.minScale,
                maxScale = params.maxScale;
            if (minScale || minScale === 0) {
                this.layer.setMinScale(minScale);
            }
            if (maxScale || maxScale === 0) {
                this.layer.setMaxScale(maxScale);
            }
        },
        
        //add folder/sublayer controls per layer.layerInfos
        _sublayers: function() {
            //check for single sublayer - if so no sublayer/folder controls
            if (this.layer.layerInfos.length > 1) {
                arrayUtil.forEach(this.layer.layerInfos, lang.hitch(this, function(info) {
                    var pid = info.parentLayerId,
                        slids = info.subLayerIds,
                        controlId = this.layer.id + '-' + info.id + '-sublayer-control',
                        control;
                    if (pid === -1 && slids === null) {
                        //it's a top level sublayer
                        control = new DynamicSublayer({
                            id: controlId,
                            control: this,
                            sublayerInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, this.expandNode, 'last');
                    } else if (pid === -1 && slids !== null) {
                        //it's a top level folder
                        control = new DynamicFolder({
                            id: controlId,
                            control: this,
                            folderInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, this.expandNode, 'last');
                    } else if (pid !== -1 && slids !== null) {
                        //it's a nested folder
                        control = new DynamicFolder({
                            id: controlId,
                            control: this,
                            folderInfo: info
                        });
                        control.startup();
                        domConst.place(control.domNode, registry.byId(this.layer.id + '-' + info.parentLayerId + '-sublayer-control').expandNode, 'last');
                    } else if (pid !== -1 && slids === null) {
                        //it's a nested sublayer
                        control = new DynamicSublayer({
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
            //perhaps check in _legend and use arcgis legend helper for < 10.01?
            if (this.layer.version >= 10.01) {
                this._legend(this.layer);
            }
        },
        
        //create the layer control menu
        _layerMenu: function() {
            this._layerMenu = new Menu({
                contextMenuForWindow: false,
                targetNodeIds: [this.labelNode],
                leftClickToOpen: true
            });
            var menu = this._layerMenu,
                params = this.params,
                layer = this.layer,
                controller = this.controller;
            
            //add custom menu items
            var layerMenuItems = params.controlOptions.layerMenuItems;
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
            var sublayerMenuItems = params.controlOptions.sublayerMenuItems;
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
            if (controller.reorder) {
                menu.addChild(new MenuItem({
                    label: 'Move Up',
                    onClick: lang.hitch(this, function() {
                        controller._moveUp(this);
                    })
                }));
                menu.addChild(new MenuItem({
                    label: 'Move Down',
                    onClick: lang.hitch(this, function() {
                        controller._moveDown(this);
                    })
                }));
                menu.addChild(new MenuSeparator());
            }
            
            //zoom to layer extent
            menu.addChild(new MenuItem({
                label: 'Zoom to Layer',
                onClick: lang.hitch(this, function() {
                    this.controller._zoomToLayer(this.layer);
                })
            }));
            
            //layer transparency
            var transparencySlider = new HorizontalSlider({
                value: layer.opacity,
                minimum: 0,
                maximum: 1,
                discreteValues: 11,
                showButtons: true,
                onChange: function(value) {
                    layer.setOpacity(value);
                    arrayUtil.forEach(query('.' + layer.id + '-layerLegendImage'), function(img) {
                        domStyle.set(img, 'opacity', value);
                    });
                }
            });
            var rule = new HorizontalRuleLabels({
                labels: ['100%', '50%', '0%'],
                style: 'height:1em;font-size:75%;'
            }, transparencySlider.bottomDecoration);
            rule.startup();
            transparencySlider.startup();
            var transparencyTooltip = new TooltipDialog({
                style: 'width:200px;',
                content: transparencySlider
            });
            domStyle.set(transparencyTooltip.connectorNode, 'display', 'none');
            transparencyTooltip.startup();
            menu.addChild(new PopupMenuItem({
                label: 'Transparency',
                popup: transparencyTooltip
            }));
            
            //and done
            menu.startup();
        },
        
        //create legends for each sublayer and place in sublayer control's expand node
        _legend: function(layer) {
            
            //get legend json
            esriRequest({
                url: layer.url + '/legend',
                callbackParamName: 'callback',
                content: {
                    f: 'json',
                    token: (typeof layer._getToken === 'function') ? layer._getToken() : null
                }
            }).then(lang.hitch(this, function(r) {
                //build table of legends for each sublayer
                arrayUtil.forEach(r.layers, function(_layer) {
                    var legendContent = '<table class="' + layer.id + '-' + _layer.layerId + '-legend layerControlLegendTable">';
                    arrayUtil.forEach(_layer.legend, function(legend) {
                        var label = legend.label || '&nbsp;';
                        legendContent += '<tr><td><img class="' + layer.id + '-layerLegendImage layerControlLegendImage" style="opacity:' + layer.opacity + ';width:' + legend.width + ';height:' + legend.height + ';" src="data:' + legend.contentType + ';base64,' + legend.imageData + '" alt="' + label + '" /></td><td>' + label + '</td></tr>';
                    }, this);
                    legendContent += '</table>';
                    
                    //check for single layer
                    //if so use expandNode for legend
                    if (layer.layerInfos.length > 1) {
                        html.set(registry.byId(layer.id + '-' + _layer.layerId + '-sublayer-control').expandNode, legendContent);
                    } else {
                        html.set(this.expandNode, legendContent);
                    }
                }, this);
            }), lang.hitch(this, function(e) {
                console.log(e);
                console.log('Dynamic::an error occurred retrieving legend');
                if (this.layer.layerInfos.length === 1) {
                    html.set(this.expandNode, 'No Legend');
                }
            }));  
        },
        
        //toggle layer visibility
        _toggleLayer: function() {
            var layer = this.layer;
            if (layer.visible) {
                layer.hide();
            } else {
                layer.show();
            }
            if (layer.minScale !== 0 || layer.maxScale !== 0) {
                this._checkboxScaleRange();
            }
        },
        
        //set dynamic layer visible layers
        _setVisibleLayers: function() {
            //because ags doesn't respect a layer group's visibility
            //i.e. layer 3 (the group) is off but it's sublayers still show
            //so check and if group is off also remove the sublayers
            var layer = this.layer,
                setLayers = [];
            arrayUtil.forEach(query('.' + layer.id + '-layer-checkbox'), function(i) {
                if (i.checked) {
                    setLayers.push(parseInt(domAttr.get(i, 'data-layer-id'), 10));
                }
            }, this);
            arrayUtil.forEach(layer.layerInfos, function(info) {
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
                layer.setVisibleLayers(setLayers);
                layer.refresh();
            } else {
                layer.setVisibleLayers([-1]);
                layer.refresh();
            }
        },
        
        //check scales and add/remove disabled classes from checkbox
        _checkboxScaleRange: function() {
            var node = this.checkbox.domNode,
                checked = this.checkbox.checked,
                layer = this.layer,
                scale = layer.getMap.getScale(),
                min = layer.minScale,
                max = layer.maxScale,
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
