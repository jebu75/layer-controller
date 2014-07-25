/* layer controller */
define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/dom-construct',
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
        applicationLayers: [],
        components: [],
        reorder: false,
        basemapCount: 0,
        dbootstrap: false,
        //private properties
        _vectorContainer: null,
        _overlayContainer: null,
        _layerControls: {
            dynamic: 'gis/dijit/LayerController/controls/Dynamic'
            //feature: 'gis/dijit/LayerController/controls/Feature',
            //image: 'gis/dijit/LayerController/controls/Image',
            //tiled: 'gis/dijit/LayerController/controls/Tiled',
            //webTiled: 'gis/dijit/LayerController/controls/WebTiled'
        },
        _components: {
            scales: 'gis/dijit/LayerController/components/Scales',
            transparency: 'gis/dijit/LayerController/components/Transparency'
        },
        _componentLabels: {
            scales: 'Visible Scales',
            transparency: 'Transparency'
        },
        _topApplicationLayers: [],
        _bottomApplicationLayers: [],
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
            //vector layer control container
            this._vectorContainer = new ControlContainer({
                className: 'overlayLayerContainer'
            }, domConst.create('div'));
            this.addChild(this._vectorContainer, 'first');
            //overlay layer control container
            this._overlayContainer = new ControlContainer({
                className: 'vectorLayerContainer'
            }, domConst.create('div'));
            this.addChild(this._overlayContainer, 'last');
            //reorder top application layers
            this.map.on('layer-add', lang.hitch(this, function () {
                
            }));
            
            //load bottom app layers here
            
            //load layer controls and components
            var modules = [];
            if (this.dbootstrap) {
                modules.push('xstyle/css!gis/dijit/LayerController/css/dbootstrap.css');
            }
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
                //load operational layers
                arrayUtil.forEach(this.operationalLayers, function(opLayer) {
                    var control = this._layerControls[opLayer.type];
                    if (control) {
                        require([control], lang.hitch(this, '_addControl', opLayer));
                    }
                }, this);
                
                //load top app layers here
                
            }));
        },
        //create layer control and add to appropriate _container
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
        //public control adding method
        //@param {Object} operational layer params
        addControl: function(opLayer) {
            var control = this._layerControls[opLayer.type];
            if (control) {
                require([control], lang.hitch(this, '_addControl', opLayer));
            } else {
                console.log('LayerController error::the layer type "' + opLayer.type + '" is not valid');
            }
        },
        
        //no control (top/bottom) application layer adding method here
        
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
                    this._overlayContainer.containerNode.insertBefore(node, node.previousSibling);
                }
            } else if (control._layerType === 'vector') {
                if (control.getPreviousSibling()) {
                    index = arrayUtil.indexOf(this.map.graphicsLayerIds, id);
                    this.map.reorderLayer(id, index + 1);
                    this._vectorContainer.containerNode.insertBefore(node, node.previousSibling);
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
                        this._overlayContainer.containerNode.insertBefore(node, node.nextSibling.nextSibling);
                    }
                }
            } else if (control._layerType === 'vector') {
                if (control.getNextSibling()) {
                    index = arrayUtil.indexOf(this.map.graphicsLayerIds, id);
                    this.map.reorderLayer(id, index - 1);
                    this._vectorContainer.containerNode.insertBefore(node, node.nextSibling.nextSibling);
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
