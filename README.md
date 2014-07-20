## Layer Controller

A layer loading and control widget for [esrijs](https://developers.arcgis.com/javascript/).

http://btfou.github.io/layer-controller/

Currently supported layers/controls:

* ArcGIS Dynamic Map Service Layers
* ArcGIS Tiled Map Service Layers
* ArcGIS Image Service Layers
* ArcGIS Feature Layers
* Web Tiled Layers
* Application (graphic) layers for your measure or results widget, which are always on top of the graphic layers stack (no control)
* Draw (graphic) layers for your draw widget, which are always on the bottom of the graphic layers stack (no control)
* and more on the way...

### Layer Controller Class

```javascript
require(['app/controls/LayerController'], function (LayerController) {
    var layerController = new LayerController({
        /* options */
    }, 'srcNodeRef');
    layerController.startup();
});
```

#### Constructor

| Option | Type | Description | Required |
| `map` | Object | Reference to the map. | true |
| `drawLayerInfos` | Array | Array of `layerParams` for adding draw layer(s) to map. Layer(s) will always be on the bottom of the graphic layers stack. | false |
| `layerInfos` | Array | Array of `layerParams` for adding layers to the map and building the controls. | false |
| `reorder` | Boolean | Whether or not to add Move Layer Up and Move Layer Down menu items to the layer context menu. Default is `false`. NOTE: Mixing overlay and vector layer controls in the same controller with `reorder: true` will cause you problems. If the rumours are true, this won't be an issue when esrijs 4.0 is released. | false |
| `basemapCount` | Integer | Number of layers at the bottom of the overlay layers stack to disregard when reordering. Default is `0`. NOTE: These layers must be added to the map before initializing the controller or indexed at the bottom of the overlay layers stack. | false |

#### Methods

| Method | Description |
| `addLayer(layerParams)` | Adds a layer control to the controller. See Layer Parameters for more info. |
| `addApplicationLayer(layerParams)` | Adds an application (graphics) layer which will always be on the top of the graphic layers stack. See Layer Parameters for more info. |

#### Events

| Event | Description |
| `add-control` | Returns an object containing the layerParams and the layer control after layer control is added to the controller. |
| 'add-application` | Returns layer after being added to map. Not working for some reason!? |

### Layer Parameters (layerParams)

An object of options for loading the layer and building the control. All layerParams (except application and draw layers) have common options:

| Option | Description |
| `type` | The layer type. Required. `dynamic`, `tiled`, `image`, `feature`, or `webTiled` |
| `id` | A valid esrijs layer id. Not required, but handy if you want to access the layer via `map.getLayer('layer_id')` for some other use. If omitted the map assigned layer id is added to layerParams and returned with the `add-control` event. |
| `label` | Label for the control. Required, but if omitted the layer controls will mixin a label reminding you to add one. |
| `visible` | Initial visibility of the layer. Default is `false`. |
| `opacity` | Initial opacity of the layer. Default is `1`. |

Additional options:

| Option | Description |
| `layerMenuItems` | Array of [dijit/MenuItem](http://dojotoolkit.org/api/?qs=1.10/dijit/MenuItem) options to be added to layer menu. Add a menu separator with `{separator: 'separator'}`. |

All layer controls extend the layer object with `layerParams`. Add as many custom options as you want. Great for custom identify and query tasks, and the like.

#### ArcGIS Dynamic Map Service Layer

Required options:

| Option | Description |
| `url` | The service URL. |

Default mixin:

```javascript
{
    label: 'Please add label option to layerParams',
    secured: false, //is service secured
    token: null, //a valid token if secured
    visible: false,
    opacity: 1,
    imageFormat: 'png32', //sublayer transparency!
    dpi: 96,
    sublayers: true //if false sublayer controls will not be created and expand/collapse icon will be removed
}
```

Additional options:

| Option | Description |
| `sublayerMenuItems` | Array of [dijit/MenuItem](http://dojotoolkit.org/api/?qs=1.10/dijit/MenuItem) options to be added to sublayer (not folder) menus. Add a menu separator with `{separator: 'separator'}`. |

Notes:

* The layer control checks for a single service sublayer, and instead of creating one sublayer control will place the legend in the layer control's expandNode and add `sublayerMenuItems` to the layer menu.

#### ArcGIS Tiled Map Service Layer

Required options:

| Option | Description |
| `url` | The service URL. |

Default mixin:

```javascript
{
    label: 'Please add label option to layerParams',
    secured: false, //is service secured
    token: null, //a valid token if secured
    visible: false,
    opacity: 1,
    resampling: true
}
```

#### ArcGIS Image Service Layer

Required options:

| Option | Description |
| `url` | The service URL. |

Default mixin:

```javascript
{
    label: 'Please add label option to layerParams',
    secured: false, //is service secured
    token: null, //a valid token if secured
    visible: false,
    opacity: 1
}
```

#### Web Tiled Layer

Required options:

| Option | Description |
| `urlTemplate` | The URL template. `http://${subDomain}.tile.stamen.com/watercolor/${level}/${col}/${row}.jpg` |

Default mixin:

```javascript
{
    label: 'Please add label option to layerParams',
    visible: false,
    opacity: 1,
    subDomains: [],
    copyright: '',
    resampling: true
}
```

#### Application Layers

`id` option is required.

Default mixin:

```javascript
{
    visible: true,
    print: false
}
```

#### ArcGIS Feature Layer

Feature layers are complex. I'm still hammering out some details.

#### Draw Layers

`id` option is required. There is no default mixin.

### To Do

* other layers: CSVLayer, GeoRSSLayer, StreamLayer, WMSLayer, WMTSLayer, GeoJSON?, others?
* minScale and maxScale layerParams and set on layer creation
* time enabled layer menu items
* layer control serialization method for map saving
* 10.0 services aren't using min and max scales for checkbox visibility (why?)

#### License

MIT

I don't much care about attribution, but if you use Layer Controller let me know.
