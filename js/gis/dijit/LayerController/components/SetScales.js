/*
 * tooltip dialog for setting layer min/max scales
 */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/html',
    'dojo/number',
    'dijit/TooltipDialog',
    'dojo/text!app/controls/templates/ScaleTooltipDialog.html',
], function (
    declare,
    lang,
    html,
    number,
    TooltipDialog,
    scaleTooltipDialogTemplate
) {
    'use strict';
    return declare([TooltipDialog], {
        templateString: scaleTooltipDialogTemplate,
        layer: null,
        constructor: function (options) {
            options = options || {};
            lang.mixin(this, options);
            this.map = this.layer.getMap();
        },
        postCreate: function () {
            this.on('show', lang.hitch(this, function () {
                this._setHtml(this.mapScaleNode, '1:' + number.format(this.map.getScale(), {places: 0}));
                this._setHtml(this.minScaleNode, this._getScale(this.layer.minScale));
                this._setHtml(this.maxScaleNode, this._getScale(this.layer.maxScale));
            }));
        },
        _setMinScale: function () {
            var mapScale = this.map.getScale();
            this.layer.setMinScale(mapScale + 1);
            this._setHtml(this.minScaleNode, this._getScale(mapScale));
        },
        _clearMinScale: function () {
            this.layer.setMinScale(0);
            this._setHtml(this.minScaleNode, 'Unlimited');
        },
        _setMaxScale: function () {
            var mapScale = this.map.getScale();
            this.layer.setMaxScale(mapScale - 1);
            this._setHtml(this.maxScaleNode, this._getScale(mapScale));
        },
        _clearMaxScale: function () {
            this.layer.setMaxScale(0);
            this._setHtml(this.maxScaleNode, 'Unlimited');
        },
        _getScale: function (scale) {
            if (scale === 0) {
                return 'Unlimited';
            } else {
                return '1:' + number.format(scale, {places: 0});
            }
        },
        _setHtml: function (node, cont, params) {
            params = params || {};
            html.set(node, cont, params);
        }
    });
});
