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
    'dijit/MenuSeparator',
    'dijit/form/CheckBox',
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
    MenuSeparator,
    CheckBox,
    ArcGISDynamicMapServiceLayer,
    esriRequest,
    DynamicSublayer,
    DynamicFolder,
    controlTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin, Contained], {
        templateString: controlTemplate,
        //options
        controller: null,
        params: null,
        //private properties
        _layerType: 'overlay',//for reoredering
        _scaleRangeHandler: null,
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
            //default mixin
            params = lang.mixin({
                type: 'dynamic',
                title: 'Please provide a layer title',
                url: null,
                token: null,
                minScale: null,
                maxScale: null,
                layerOptions: {
                    visible: false
                },
                layer: null,
                layerExtend: {},
                controlOptions: {}
            }, params);
            //control options mixin
            //a separate mixin is required for nested objects and arrays
            //saves much code by eliminating the need for checks
            params.controlOptions = lang.mixin({
                sublayers: true,
                visibleLayers: [],
                components: [],
                layerMenuItems: [],
                sublayerMenuItems: []
            }, params.controlOptions);
            this.params = params;
            //are we using a layer or loading one
            if (params.layer && params.layer.isInstanceOf('esri.layers.ArcGISDynamicMapServiceLayer')) {
                this.layer = params.layer;
            } else if (params.layerOptions) {
                var token = params.token;
                this.layer = new ArcGISDynamicMapServiceLayer((token) ? params.url + '?token=' + token : params.url, params.layerOptions);
                //reset url if secured
                if (token) {
                    this.layer.url = params.url;
                }
                map.addLayer(this.layer);
            } else {
                console.log('Dynamic error::a valid dynamic layer or layerOptions are required');
                html.set(this.labelNode, params.title + ': Invalid Layer');
                return;
            }
            lang.mixin(this.layer, params.layerExtend);
            if (params.layerOptions.visible) {
                domClass.remove(this.checkNode, 'fa-square-o');
                domClass.add(this.checkNode, 'fa fa-check-square-o');
            }
            on(this.checkNode, 'click', lang.hitch(this, '_toggleLayer'));
            html.set(this.labelNode, params.title);
            this.layer.on('update-start', lang.hitch(this, function() {
                domStyle.set(this.layerUpdateNode, 'display', 'inline-block'); //font awesome display
            }));
            this.layer.on('update-end', lang.hitch(this, function() {
                domStyle.set(this.layerUpdateNode, 'display', 'none');
            }));
            if (params.controlOptions.sublayers) {
                this._expandClick();
                if (this.layer.loaded) {
                    this._load(true);
                } else {
                    this.layer.on('load', lang.hitch(this, '_load', true));
                }
            } else {
                if (!params.controlOptions.sublayers && params.controlOptions.visibleLayers.length === 1) {
                    this._expandClick();
                    if (this.layer.loaded) {
                        if (this.layer.version >= 10.01) {
                            this._legend(this.layer);
                        }
                    } else {
                        this.layer.on('load', lang.hitch(this, function () {
                            if (this.layer.version >= 10.01) {
                                this._legend(this.layer);
                            }
                        }));
                    }
                } else {
                    domClass.remove(this.expandIconNode, ['fa', 'fa-plus-square-o', 'layerControlToggleIcon']);
                    domStyle.set(this.expandIconNode, 'cursor', 'default');
                    domConst.destroy(this.expandNode);
                }
                if (this.layer.loaded) {
                    this._load(false);
                } else {
                    this.layer.on('load', lang.hitch(this, '_load', false));
                }
            }
            this.layer.on('scale-range-change', lang.hitch(this, function() {
                if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                    this._checkboxScaleRange();
                    this._scaleRangeHandler = map.on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
                } else {
                    this._checkboxScaleRange();
                    if (this._scaleRangeHandler) {
                        this._scaleRangeHandler.remove();
                        this._scaleRangeHandler = null;
                    }
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
        //add on event to expandClickNode
        _expandClick: function () {
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
        },
        //called on 'load'
        _load: function (sublayers) {
            this._menu();
            var visibleLayers = this.params.controlOptions.visibleLayers;
            if (sublayers) {
                this._sublayers();
            } else if (!sublayers && visibleLayers.length) {
                this.layer.setVisibleLayers(visibleLayers);
                this.layer.refresh();
            }
            if (this.layer.minScale !== 0 || this.layer.maxScale !== 0) {
                this._checkboxScaleRange();
                this._scaleRangeHandler = this.layer.getMap().on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
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
        _menu: function() {
            var menu = new Menu({
                contextMenuForWindow: false,
                targetNodeIds: [this.labelNode],
                leftClickToOpen: true
            });
            var params = this.params,
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
                    this.controller._zoomToLayer(layer);
                })
            }));
            //add components
            if (params.controlOptions.components.length) {
                var modules = [];
                arrayUtil.forEach(params.controlOptions.components, function(component) {
                    var mod = this.controller._components[component];
                    if (mod) {
                        modules.push(mod);
                    }
                }, this);
                require(modules, lang.hitch(this, function() {
                    arrayUtil.forEach(params.controlOptions.components, function(component) {
                        var item = this.controller._components[component];
                        if (item) {
                            require([item], lang.hitch(this, function(Component) {
                                menu.addChild(new Component({
                                    label: this.controller._componentLabels[component],
                                    layer: layer
                                }));
                            }));
                        }
                    }, this);
                }));
            }
            menu.startup();
        },
        //get legend json and build
        _legend: function(layer) {
            esriRequest({
                url: layer.url + '/legend',
                callbackParamName: 'callback',
                content: {
                    f: 'json',
                    token: (typeof layer._getToken === 'function') ? layer._getToken() : null
                }
            }).then(lang.hitch(this, function(r) {
                arrayUtil.forEach(r.layers, function(_layer) {
                    var legendContent;
                    if (!this.params.controlOptions.sublayers && this.params.controlOptions.visibleLayers.length === 1) {
                        var layerId = this.params.controlOptions.visibleLayers[0];
                        legendContent = '<table class="layerControlLegendTable">';
                        arrayUtil.forEach(r.layers[layerId].legend, function(legend) {
                            var label = legend.label || '&nbsp;';
                            legendContent += '<tr><td class="layerControlLegendImage"><img class="' + layer.id + '-layerLegendImage" style="width:' + legend.width + ';height:' + legend.height + ';" src="data:' + legend.contentType + ';base64,' + legend.imageData + '" alt="' + label + '" /></td><td class="layerControlLegendLabel">' + label + '</td></tr>';
                        }, this);
                        legendContent += '</table>';
                        html.set(this.expandNode, legendContent);
                    } else {
                        legendContent = '<table class="layerControlLegendTable">';
                        arrayUtil.forEach(_layer.legend, function(legend) {
                            var label = legend.label || '&nbsp;';
                            legendContent += '<tr><td class="layerControlLegendImage"><img class="' + layer.id + '-layerLegendImage" style="opacity:' + layer.opacity + ';width:' + legend.width + ';height:' + legend.height + ';" src="data:' + legend.contentType + ';base64,' + legend.imageData + '" alt="' + label + '" /></td><td class="layerControlLegendLabel">' + label + '</td></tr>';
                        }, this);
                        legendContent += '</table>';
                        //check for single layer
                        //if so use expandNode for legend
                        if (layer.layerInfos.length > 1) {
                            html.set(registry.byId(layer.id + '-' + _layer.layerId + '-sublayer-control').expandNode, legendContent);
                        } else {
                            html.set(this.expandNode, legendContent);
                        }
                    }
                }, this);
            }), lang.hitch(this, function(e) {
                console.log(e);
                console.log('Dynamic::an error occurred retrieving legend');
                if ((this.layer.layerInfos.length === 1) || (!this.params.controlOptions.sublayers && this.params.controlOptions.visibleLayers.length === 1)) {
                    html.set(this.expandNode, 'No Legend');
                }
            }));  
        },
        //toggle layer visibility
        _toggleLayer: function() {
            var layer = this.layer;
            if (layer.visible) {
                layer.hide();
                domClass.remove(this.checkNode, 'fa-check-square-o');
                domClass.add(this.checkNode, 'fa-square-o');
            } else {
                layer.show();
                domClass.remove(this.checkNode, 'fa-square-o');
                domClass.add(this.checkNode, 'fa-check-square-o');
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
            arrayUtil.forEach(query('.' + layer.id + '-layerControlSublayerCheck'), function(i) {
                if (domAttr.get(i, 'data-checked') === 'checked') {
                    setLayers.push(parseInt(domAttr.get(i, 'data-sublayer-id'), 10));
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
            var node = this.checkNode,
                layer = this.layer,
                scale = layer.getMap().getScale(),
                min = layer.minScale,
                max = layer.maxScale;
            domClass.remove(node, 'layerControlCheckIconOutScale');
            if ((min !== 0 && scale > min) || (max !== 0 && scale < max)) {
                domClass.add(node, 'layerControlCheckIconOutScale');
            }
        }
    });
});
