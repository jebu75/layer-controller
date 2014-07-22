/*
 * a container widget for layer controls
 */
define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dijit/_WidgetBase',
    'dijit/_Container',
    'dojo/Evented',
    'esri/layers/GraphicsLayer'
], function(
    declare,
    arrayUtil,
    lang,
    WidgetBase,
    Container,
    Evented,
    GraphicsLayer
) {
    'use strict';
    
    //only load layer controls as needed via nested requires
    
    
    function loadDLC(layerParams, func) {
        require(['app/controls/DynamicLayerControl'], function (x) {
            DynamicLayerControl = x;
            func(layerParams);
        });
    }
    
    function loadTLC(layerParams, func) {
        require(['app/controls/TiledLayerControl'], function (x) {
            TiledLayerControl = x;
            func(layerParams);
        });
    }
    
    function loadILC(layerParams, func) {
        require(['app/controls/ImageLayerControl'], function (x) {
            ImageLayerControl = x;
            func(layerParams);
        });
    }
    
    function loadFLC(layerParams, func) {
        require(['app/controls/FeatureLayerControl'], function (x) {
            FeatureLayerControl = x;
            func(layerParams);
        });
    }
    
    function loadWTLC(layerParams, func) {
        require(['app/controls/WebTiledLayerControl'], function (x) {
            WebTiledLayerControl = x;
            func(layerParams);
        });
    }
    
    return declare([WidgetBase, Container, Evented], {
        //options
        map: null, //reference to the map
        layerInfos: [], //array of layerParams
        drawLayerInfos: [], //array of draw layer(s)
        reorder: false, //allow layer reordering
        basemapCount: 0, //number of basemaps
        //private properties
        _layerControls: {
            dynamic: 'app/controls/DynamicLayerControl',
            feature: 'app/controls/FeatureLayerControl',
            image: 'app/controls/ImageLayerControl',
            tiled: 'app/controls/TiledLayerControl',
            webTiled: 'app/controls/WebTiledLayerControl'
        },
        _drawLayers: [], //draw (keep on bottom) layers
        _applicationLayers: [], //application (keep on top) layers
        constructor: function(options) {
            options = options || {};
            if (!options.map) {
                console.log('LayerController error::map option is required');
                return;
            }
            lang.mixin(this, options);
        },
        
        postCreate: function() {
            //reorder application layers to the top on 'layer-add'
            this.map.on('layer-add', lang.hitch(this, this._reorderApplicationLayers));
            
            //add draw layer(s)
            //layer(s) will always be below all other vector layers
            if (this.drawLayerInfos.length) {
                this._addDrawLayers();
            }
            
            var modules = [];
            
            arrayUtil.forEach(this.layerInfos, function(layerParams) {
                var control = this._layerControls[layerParams.type];
                if (control) {
                    modules.push(control);
                } else {
                    console.log('LayerController error::the layer type "' + layerParams.type + '" is not valid');
                }
            }, this);
            
            require(modules, lang.hitch(this, function() {
                arrayUtil.forEach(this.layerInfos, function(layerParams) {
                    var control = this._layerControls[layerParams.type];
                    if (control) {
                        require([control], lang.hitch(this, '_addControl', layerParams));
                    }
                }, this);
            }));
        },
        
        _addControl: function (layerParams, LayerControl) {
            var layerControl = new LayerControl({
                controller: this,
                layerParams: layerParams
            });
            layerControl.startup();
            this.addChild(layerControl, 'first');
            this.emit('control-add', {
                layerParams: layerControl.layerParams,
                layerControlId: layerControl.id
            });
        },
        
        //adds the appropriate layer control
        //@param layerParams {Object} params for the layer and control
        addControl: function(layerParams) {
            
        },
        
        //add always on top graphics layer
        //@param layerParams {Object} params for the layer
        addApplicationLayer: function (layerParams) {
            if (!layerParams.id) {
                console.log('LayerController error::id property is required for application layers');
            }
            var lp = lang.mixin({
                visible: true,
                print: false
            }, layerParams);
            var layer = new GraphicsLayer({
                id: lp.id,
                visible: lp.visible
            });
            layer.layerParams = lp;
            this.map.addLayer(layer, 0);
            this._applicationLayers.push(layer);
            
            //why isn't this working???
            //console.log(layer);
            this.emit('add-application', {layer: layer});
            //console.log(layer);
        },
        
        //move control up in controller and layer up in map
        _moveUp: function (control) {
            var id = control.layer.id,
                node = control.domNode,
                index;
            if (control._layerType === 'overlay') {
                var count = this.map.layerIds.length;
                index = arrayUtil.indexOf(this.map.layerIds, id);
                if (index < count - 1) {
                    this.map.reorderLayer(id, index + 1);
                    this.containerNode.insertBefore(node, node.previousSibling);
                }
            } else if (control._layerType === 'vector') {
                if (control.getPreviousSibling()) {
                    index = arrayUtil.indexOf(this.map.graphicsLayerIds, id);
                    this.map.reorderLayer(id, index + 1);
                    this.containerNode.insertBefore(node, node.previousSibling);
                }
            }
        },
        
        //move control down in controller and layer down in map
        _moveDown: function (control) {
            var id = control.layer.id,
                node = control.domNode,
                index;
            if (control._layerType === 'overlay') {
                index = arrayUtil.indexOf(this.map.layerIds, id);
                if (index > this.basemapCount) {
                    this.map.reorderLayer(id, index - 1);
                    if (node.nextSibling !== null) {
                        this.containerNode.insertBefore(node, node.nextSibling.nextSibling);
                    }
                }
            } else if (control._layerType === 'vector') {
                if (control.getNextSibling()) {
                    index = arrayUtil.indexOf(this.map.graphicsLayerIds, id);
                    this.map.reorderLayer(id, index - 1);
                    this.containerNode.insertBefore(node, node.nextSibling.nextSibling);
                }
            }
        },
        
        //reorders application layers to top on layer add
        _reorderApplicationLayers: function() {
            arrayUtil.forEach(this._applicationLayers, function(appLayer) {
                this.map.reorderLayer(appLayer, this.map.graphicsLayerIds.length - 1);
            }, this);
        },
        
        //add draw layer(s) to map
        _addDrawLayers: function() {
            arrayUtil.forEach(this.drawLayerInfos, function (layerParams) {
                if (layerParams.id) {
                    var layer = new GraphicsLayer({id: layerParams.id});
                    layer.layerParams = layerParams;
                    this.map.addLayer(layer);
                    this._drawLayers.push(layer);
                } else {
                    console.log('LayerController error::id property is required for draw layers');
                }
            }, this);
        }
    });
});
