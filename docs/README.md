### Layer Controller Docs

#### LayerController Class

#### Layer Controls

Each layer type has its own control, which is created by and contained within a LayerController. These docs do not cover constructor, methods or events for layer controls as they are dependent on a LayerController.

All layer controls can be created in two ways. 1) Including `layerOptions` in the parameters object will load and configure the layer. 2) Including `layer` will use an existing layer.

* [Dynamic Control]()

#### Application Layers

Application layers are graphics layers for use with custom result, measure, draw and other modules in the application. Application layers can assigned to be on top or bottom of the vector layers stack with operational vector layer sandwiched between. Application layers can be added by the LayerController when it is created or after the application is loaded.

[Application Layers]()

#### Components

Components are essentially menu items that are added to the layer menu for setting layer transparency, layer scales, and the like.

To help maintain the lightest footprint possible, all components are conditionally loaded via the LayerController constructor.

Scales

