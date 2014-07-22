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
    'esri/layers/FeatureLayer',
    'esri/InfoTemplate',
    'esri/request',
    'esri/tasks/ProjectParameters',
    'esri/config',
    'dojox/gfx',
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
    FeatureLayer,
    InfoTemplate,
    esriRequest,
    ProjectParameters,
    esriConfig,
    gfx,
    layerControlTemplate
) {
    'use strict';
    return declare([WidgetBase, TemplatedMixin, Contained], {
        //template
        templateString: layerControlTemplate,
        
        //for reoredering
        _layerType: 'vector',
        
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
                console.log('FeatureLayerControl error::layerParams option is required');
                this.destroy();
                return;
            }
            if (!this.map) {
                console.log('FeatureLayerControl error::map option is required');
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
                mode: 1,
                outFields: ['*'],
                infoTemplate: {
                    type: 'none',
                    title: '',
                    content: ''
                }
            }, layerParams);
            this.layerParams = lp;
            
            //the layer
            this.layer = new FeatureLayer((lp.secured) ? lp.url + '?token=' + lp.token : lp.url, {
                id: lp.id || null,
                mode: lp.mode,
                outFields: lp.outFields,
                visible: lp.visible,
                opacity: lp.opacity
            });
            
            //reset url if secured
            if (lp.secured) {
                this.layer.url = lp.url;
            }
            
            //create info template for layer
            if (lp.infoTemplate) {
                switch (lp.infoTemplate.type) {
                    case 'custom':
                        this.layer.setInfoTemplate(new InfoTemplate(lp.infoTemplate.title, lp.infoTemplate.content));
                        break;
                    case 'none':
                        this.layer.setInfoTemplate(null);
                        break;
                    default:
                        this.layer.setInfoTemplate(new InfoTemplate());
                        break;
                }
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
            
            
            this.layer.on('load', lang.hitch(this, function() {
                //create layer menu
                this._layerMenu();
                
                //create legend
                if (this.layer.version >= 10.01) {
                    this._legend();
                }
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
                    arrayUtil.forEach(query('.' + lp.id + '-layerLegendImage'), function(img) {
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
        
        //create legend for feature layer
        _legend: function() {
            //get legend json
            var url = this.layer.url;
            url = url.replace('FeatureServer', 'MapServer');
            url = url.substring(0, url.length - 2);
            esriRequest({
                url: url + '/legend',
                callbackParamName: 'callback',
                content: {
                    f: 'json',
                    token: (typeof this.layer._getToken === 'function') ? this.layer._getToken() : null
                }
            }).then(lang.hitch(this, function(r) {
                var legendContent = '<table class="' + this.layer.id + '-' + this.layer.layerId + '-legend layerControlLegendTable">';
                arrayUtil.forEach(r.layers[this.layer.layerId].legend, function(legend) {
                    var label = legend.label || '&nbsp;';
                    legendContent += '<tr><td><img class="' + this.layer.id + '-layerLegendImage layerControlLegendImage" style="width:' + legend.width + ';height:' + legend.height + ';" src="data:' + legend.contentType + ';base64,' + legend.imageData + '" alt="' + label + '" /></td><td>' + label + '</td></tr>';
                }, this);
                legendContent += '</table>';
                this.expandNode.innerHTML = legendContent;
                
                //set opacity per layer.opacity
                arrayUtil.forEach(query('.' + this.layer.id + '-layerLegendImage'), function(img) {
                    domStyle.set(img, 'opacity', this.layer.opacity);
                }, this);
            }), lang.hitch(this, function(e) {
                console.log(e);
                console.log('FeatureLayerControl::an error occurred retrieving legend');
                this.expandNode.innerHTML = 'No Legend';
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
                    console.log('FeatureLayerControl _zoomToLayer::esriConfig.defaults.geometryService is not set');
                }
            }
        }
    });
});
