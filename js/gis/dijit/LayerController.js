/* layer controller */
define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/dom-construct',
    'dojo/dom-class',
    'dijit/_WidgetBase',
    'dijit/_Container',
    'dojo/Evented',
    'esri/layers/GraphicsLayer',
    'esri/tasks/ProjectParameters',
    'esri/config',
    //the css
    'xstyle/css!gis/dijit/LayerController/css/LayerController.css'
], function (
    declare,
    arrayUtil,
    lang,
    domConst,
    domClass,
    WidgetBase,
    Container,
    Evented,
    GraphicsLayer,
    ProjectParameters,
    esriConfig
) {
    'use strict';
    return declare([WidgetBase, Container, Evented], {
        //options
        map: null,
        operationalLayers: [],
        applicationLayers: {
            top: [],
            bottom: []
        },
        components: [],
        reorder: false,
        basemapCount: 0,
        
        //private properties
        _vectorContainer: null,
        _overlayContainer: null,
        _layerControls: {
            dynamic: 'gis/dijit/LayerController/controls/Dynamic',
            feature: 'gis/dijit/LayerController/controls/Feature',
            image: 'gis/dijit/LayerController/controls/Image',
            tiled: 'gis/dijit/LayerController/controls/Tiled',
            webTiled: 'gis/dijit/LayerController/controls/WebTiled'
        },
        _components: {
            Scales: 'gis/dijit/LayerController/components/Scales',
            Transparency: 'gis/dijit/LayerController/components/Transparency',
            Interval: 'gis/dijit/LayerController/components/Interval'
        },
        _applicationLayers: [],
        
        constructor: function(options) {
            options = options || {};
            
            if (!options.map) {
                console.log('LayerController error::map option is required');
                return;
            }
            
            lang.mixin(this, options);
        },
        
        postCreate: function() {
            var ControlContainer = declare([WidgetBase, Container]);
            
            this._vectorContainer = new ControlContainer({
                map: this.map
            }, domConst.create('div'));
            this.addChild(this._vectorContainer, 'first');
            //add .vectorLayerContainer
            
            this._overlayContainer = new ControlContainer({
                map: this.map
            }, domConst.create('div'));
            this.addChild(this._overlayContainer, 'last');
            //add .overlayLayerContainer
            
            //reorder top application layers
            this.map.on('layer-add', lang.hitch(this, function () {
                
            }));
            
            if (this.applicationLayers.bottom.length) {
                arrayUtil.forEach(this.applicationLayers.bottom, function (appLayer) {
                    this.addApplicationLayer(appLayer, 'bottom');
                }, this);
            }
            
            var modules = [];
            
            arrayUtil.forEach(this.components, function(component) {
                var mod = this._components[component];
                if (mod) {
                    modules.push(mod);
                } else {
                    console.log('LayerController error::the component "' + component + '" is not valid');
                }
            }, this);
            
            arrayUtil.forEach(this.operationalLayers, function(opLayer) {
                var mod = this._layerControls[opLayer.type];
                if (mod) {
                    modules.push(mod);
                } else {
                    console.log('LayerController error::the layer type "' + opLayer.type + '" is not valid');
                }
            }, this);
            
            require(modules, lang.hitch(this, function() {
                arrayUtil.forEach(this.operationalLayers, function(opLayer) {
                    var control = this._layerControls[opLayer.type];
                    if (control) {
                        require([control], lang.hitch(this, '_addControl', opLayer));
                    }
                }, this);
                
                if (this.applicationLayers.top.length) {
                    arrayUtil.forEach(this.applicationLayers.top, function (appLayer) {
                        this.addApplicationLayer(appLayer, 'top');
                    }, this);
                }
            }));
        },
        
        _addControl: function (opLayer, LayerControl) {
            var layerControl = new LayerControl({
                controller: this,
                params: opLayer
            });
            layerControl.startup();
            
            if (layerControl._layerType === 'overlay') {
                this._overlayContainer.addChild(layerControl, 'first');
            } else {
                this._vectorContainer.addChild(layerControl, 'first');
            }
            
            this.emit('control-add', {
                layerId: layerControl.layer.id,
                layerControlId: layerControl.id
            });
        },
        
        addControl: function(opLayer) {
            var control = this._layerControls[opLayer.type];
            if (control) {
                require([control], lang.hitch(this, '_addControl', opLayer));
            } else {
                console.log('LayerController error::the layer type "' + opLayer.type + '" is not valid');
            }
        },
        
        addApplicationLayer: function (appLayer, position) {
            appLayer = appLayer || {layerOptions: {}};
            
            if (!appLayer.layerOptions.id) {
                console.log('LayerController error::layerOptions.id property is required for application layers');
                return;
            }
            
            var layer = new GraphicsLayer(appLayer.layerOptions);
            
            var layerExtend = appLayer.layerExtend || {};
            layerExtend._position = position;
            lang.mixin(layer, layerExtend);
            
            var index = (appLayer.position === 'bottom') ? 0 : this.map.graphicsLayerIds.length;
            
            this.map.addLayer(layer, index);
            
            this._applicationLayers.push(layer);
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
        
        //zoom to layer
        _zoomToLayer: function(layer) {
            var map = this.map;
            if (layer.spatialReference === map.spatialReference) {
                map.setExtent(layer.fullExtent, true);
            } else {
                if (esriConfig.defaults.geometryService) {
                    esriConfig.defaults.geometryService.project(lang.mixin(new ProjectParameters(), {
                        geometries: [layer.fullExtent],
                        outSR: map.spatialReference
                    }), function(r) {
                        map.setExtent(r[0], true);
                    }, function(e) {
                        console.log(e);
                    });
                } else {
                    console.log('LayerController _zoomToLayer::esriConfig.defaults.geometryService is not set');
                }
            }
        }
    });
});
