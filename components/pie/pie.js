/* eslint-disable no-nested-ternary, prefer-arrow-callback */
/* jshint esversion:6 */

// Other Shared Imports
import * as debug from '../utils/debug';
import { utils } from '../utils/utils';
import { charts } from '../charts/charts';
import { Locale } from '../locale/locale';

// Settings and Options
const COMPONENT_NAME = 'pie';

/**
* @namespace
* @property {array} dataset The data to use in the line/area/bubble.
* @property {boolean} isDonut If true it renders as a donut chart.
* @property {number} animationSpeed Controls the animation speed
* @property {boolean|string} animate true|false - will do or not do the animation.
* 'initial' will do only first time the animation.
* @property {boolean} redrawOnResize If true, the component will not resize when resizing the page.
* @property {boolean} showTooltips If false now tooltips will be shown even if
* there is tooltip values provided.
* @property {boolean} showLines If false connector lines wont be shown
* @property {boolean} showLinesMobile This defaults to false, when false and under 450px the lines
* will not be shown. If you still want lines at the lower breakpoint you can set this to true
* @property {boolean} showLegend If false the legend will not be shown.
* @property {string} legendPlacement Where to locate the legend. This can be bottom or right at
* the moment.
* @property {object} lines A setting that controls the line values and format.
* @property {string} line.show Controls the line value, this can be value, label or percent or
* custom function.
* @property {object} line.formatter The d3.formatter string.
*/
const PIE_DEFAULTS = {
  dataset: [],
  isDonut: false,
  animationSpeed: 600,
  animate: true,
  redrawOnResize: true,
  showTooltips: true,
  showLines: true,
  showLinesMobile: false,
  showLegend: true,
  legendPlacement: 'right', // Can be bottom or right
  lines: {
    show: 'value', // value, label or percent or custom function
    formatter: '.0s'
  },
  legend: {
    show: 'value', // value, label or percent or custom function
    formatter: '.0s'
  },
  tooltip: {
    show: 'value', // value, label or percent or custom function
    formatter: '.0s'
  }
};

/**
 * A pie chart (or a circle chart) is a circular statistical graphic which is divided into slices
 * to illustrate numerical proportion. In a pie chart, the arc length of each slice is proportional
 * to the quantity it represents.
 * @class Pie
 * @param {string} element The plugin element for the constuctor
 * @param {string} settings The settings element.
 */
function Pie(element, settings) {
  this.settings = utils.mergeSettings(element, settings, PIE_DEFAULTS);
  this.element = $(element);
  debug.logTimeStart(COMPONENT_NAME);
  this.init();
  debug.logTimeStart(COMPONENT_NAME);
}

// Plugin Methods
Pie.prototype = {

  /**
   * Do initialization, build up and / or add events ect.
   * @private
   * @returns {object} The component prototype for chaining.
   */
  init() {
    this
      .build()
      .handleEvents();

    // Handle initial option
    if (this.settings.animate === 'initial') {
      this.settings.animate = false;
    }

    return this;
  },

  /**
   * Build the Component.
   * @returns {object} The component prototype for chaining.
   * @private
   */
  build() {
    const self = this;

    self.svg = d3.select(this.element[0])
      .append('svg');

    self.mainGroup = self.svg.append('g');

    self.mainGroup.append('g').attr('class', 'slices');
    self.mainGroup.append('g').attr('class', 'labels');
    self.mainGroup.append('g').attr('class', 'lines');
    this.element.addClass('chart-pie');

    if (self.settings.legendPlacement) {
      this.element.addClass(`has-${self.settings.legendPlacement}-legend`);
    }

    const w = parseInt(this.element.width(), 10);

    const dims = {
      height: parseInt(this.element.height(), 10),
      width: w
    };

    if (self.settings.legendPlacement === 'right') {
      dims.width = w * 0.75;
    }

    dims.radius = Math.min(dims.width, dims.height) / 2;
    self.dims = dims;

    self.pie = d3.pie()
      .sort(null)
      .value(function (d) {
        return d.value;
      });

    self.arc = d3.arc()
      .outerRadius(dims.radius * 0.75)
      .innerRadius(self.settings.isDonut ? dims.radius * 0.4 : 0);

    // Influences the label position
    self.outerArc = d3.arc()
      .innerRadius(dims.radius * 0.75)
      .outerRadius((dims.radius * 0.75 + 20));

    self.svg
      .attr('width', self.settings.legendPlacement === 'right' ? '75%' : '100%')
      .attr('height', '100%');

    self.mainGroup
      .attr('transform', `translate(${dims.width / 2},${dims.height / 2})`);

    // move the origin of the group's coordinate space to the center of the SVG element
    dims.center = { x: (dims.width / 2), y: dims.height / 2 };

    self.key = function (d) { return d.data.name; };
    const isEmpty = !self.settings.dataset || self.settings.dataset.length === 0;
    this.chartData = !isEmpty ? self.settings.dataset[0].data : [];
    this.sum = d3.sum(this.chartData, function (d) { return d.value; });

    // Calculate the percentages
    const values = this.chartData.map(function (d) { return d.value / self.sum * 100; });
    const rounded = this.roundLargestRemainer(values);

    this.chartData = this.chartData.map(function (d, i) {
      d.percent = d.value / self.sum;
      d.percentRound = rounded[i];
      return d;
    });

    let sum = 0;
    this.chartData.map(function (d) { // eslint-disable-line
      sum += d.percentRound;
    });

    // Handle zero sum or empty pies
    if (isEmpty || sum === 0) {
      this.chartData.push({ data: {}, color: '#BDBDBD', name: 'Empty-Pie', value: 100, percent: 1, percentRound: 100 });
    }

    // 1. Animate on reload example
    // self.update(self.chartData);
    // setTimeout(function () {
    //  self.update(self.randomize());
    // }, 4000);
    // charts.appendTooltip();

    // 2. Animate initial - looks wierd
    // const temp = JSON.parse(JSON.stringify(self.chartData));
    // self.update(self.randomize(true));
    // self.chartData = JSON.parse(JSON.stringify(temp));
    // setTimeout(function () {
    //   self.update(self.chartData);
    // }, 0);

    self.update(self.chartData);
    if (self.settings.showTooltips) {
      charts.appendTooltip('is-pie');
    }

    if (this.settings.showLegend) {
      const series = self.chartData.map(function (d) {
        let name = `${d.name} (${isNaN(d.percentRound) ? 0 : d.percentRound}%)`;

        if (self.settings.legendFormatter) {
          name = `${d.name} (${d3.format(self.settings.legendFormatter)(d.value)})`;
        }

        if (d.name === 'Empty-Pie') {
          name = '';
        }
        return { name, display: 'twocolumn', placement: self.settings.legendPlacement, color: d.color };
      });

      this.settings.svg = self.svg;
      charts.addLegend(series, 'pie', this.settings, this.element);
    }

    this.setInitialSelected();
    this.element.trigger('rendered');
    return this;
  },

  randomize(toZero) {
    const self = this;
    this.chartData = this.chartData.map(function (d) {
      d.value = toZero ? 0 : Math.random();
      return d;
    });

    this.sum = d3.sum(this.chartData, function (d) { return d.value; });
    const values = this.chartData.map(function (d) { return d.value / self.sum * 100; });
    const rounded = this.roundLargestRemainer(values);

    this.chartData = this.chartData.map(function (d, i) {
      d.percent = d.value / self.sum;
      d.percentRound = rounded[i];
      return d;
    });

    return this.chartData;
  },

  /**
   * Update the chart with a new dataset
   * @private
   * @param  {object} data The data to use.
   */
  update(data) {
    // Pie Slices
    const self = this;
    let tooltipInterval;
    const isEmpty = !self.settings.dataset || self.settings.dataset.length === 0;
    const slice = self.svg.select('.slices').selectAll('path.slice')
      .data(self.pie(data), self.key);

    slice.enter()
      .insert('path')
      .style('fill', function (d, i) {
        return charts.chartColor(self.isRTL ? self.chartData.length - (i - 1) : i, 'pie', d.data);
      })
      .attr('class', 'slice')
      .on('contextmenu', function (d) {
        // Handle Right Click Menu
        charts.triggerContextMenu(self.element, d3.select(this).select('path').nodes()[0], d);
      })
      .on('click', function (d, i) {
        clearTimeout(tooltipInterval);
        // Handle Click to select
        const isSelected = this && d3.select(this).classed('is-selected');

        // Make unselected
        charts.setSelectedElement({
          task: isSelected ? 'unselected' : 'selected',
          container: self.element,
          selector: isSelected ? '.chart-container .is-selected' : this,
          isTrigger: !isSelected,
          d: d.data,
          i,
          type: self.settings.type,
          dataset: self.settings.dataset,
          svg: self.svg
        });

        if (isSelected) {
          self.element.triggerHandler('selected', [d3.select(this).nodes(), {}, i]);
        }
      })
      .on('mouseenter', function (d, i) {
        if (!self.settings.showTooltips) {
          return;
        }
        // See where to position
        const dot = self.svg.selectAll('circle').nodes()[i];
        const offset = $(dot).offset();

        // See where we want the arrow
        const rads = self.midAngle(d);

        // https://www.wyzant.com/resources/lessons/math/trigonometry/unit-circle
        const isTop = (rads < (Math.PI / 4) && rads > 0) || rads > (7 * Math.PI / 4);
        const isRight = rads < (3 * Math.PI / 4) && rads > (Math.PI / 4);
        const isBottom = rads < (5 * Math.PI / 4) && rads > (3 * Math.PI / 4);
        const isLeft = rads < (7 * Math.PI / 4) && rads > (5 * Math.PI / 4);

        // Build the content
        let content = '';
        const show = function () {
          if (content === '') {
            return;
          }

          const size = charts.tooltipSize(content);
          let x = offset.left;
          let y = offset.top;
          const padding = 5;

          if (isTop) {
            x -= size.width / 2;
            y -= size.height - padding;
            charts.showTooltip(x, y, content, 'top');
          }
          if (isRight) {
            y -= size.height / 2;
            charts.showTooltip(x, y, content, 'right');
          }
          if (isBottom) {
            x -= size.width / 2;
            // y -= padding;
            charts.showTooltip(x, y, content, 'bottom');
          }
          if (isLeft) {
            x -= size.width - padding;
            y -= size.height / 2;
            charts.showTooltip(x, y, content, 'left');
          }
        };

        content = d.data.tooltip || '';
        content = content.replace('{{percent}}', `${d.data.percentRound}%`);
        content = content.replace('{{value}}', d.value);
        content = content.replace('%percent%', `${d.data.percentRound}%`);
        content = content.replace('%value%', d.value);

        // Debounce it a bit
        if (tooltipInterval != null) {
          clearTimeout(tooltipInterval);
        }

        tooltipInterval = setTimeout(function () {
          show();
        }, 300);
      })
      .on('mouseleave', function () {
        clearTimeout(tooltipInterval);
        charts.hideTooltip();
      })
      .merge(slice)
      .transition()
      .duration(self.settings.animationSpeed)
      .attrTween('d', function (d) {
        this.current = this.current || d;
        const interpolate = d3.interpolate(this.current, d);
        this.current = interpolate(0);
        return function (t) {
          return self.arc(interpolate(t));
        };
      });

    slice.exit()
      .remove();

    if (isEmpty) {
      return;
    }

    const isMobile = self.element.parent().width() < 520;
    let shouldShow = self.settings.showLines;

    if (!self.settings.showLinesMobile && shouldShow) {
      shouldShow = !isMobile;
    }

    // Text Labels
    if (shouldShow) {
      const text = self.svg.select('.labels').selectAll('text')
        .data(self.pie(data), self.key);

      text.enter()
        .append('text')
        .attr('dy', '.35em')
        .text(function (d) {
          return self.formatToSettings(d, self.settings.lines);
        })
        .merge(text)
        .transition()
        .duration(self.settings.animationSpeed)
        .attrTween('transform', function (d) {
          this.current = this.current || d;
          const interpolate = d3.interpolate(this.current, d);
          this.current = interpolate(0);
          return function (t) {
            const d2 = interpolate(t);
            const pos = self.outerArc.centroid(d2);
            pos[0] = self.dims.radius * (self.midAngle(d2) < Math.PI ? 1 : -1);
            return `translate(${pos})`;
          };
        })
        .styleTween('text-anchor', function (d) {
          this.current = this.current || d;
          const interpolate = d3.interpolate(this.current, d);
          this.current = interpolate(0);
          return function (t) {
            const d2 = interpolate(t);
            return self.midAngle(d2) < Math.PI ? 'start' : 'end';
          };
        });

      text.exit()
        .remove();

      // Slice to text poly lines
      const polyline = self.svg.select('.lines').selectAll('polyline')
        .data(self.pie(data), self.key);

      polyline.enter()
        .append('polyline')
        .merge(polyline)
        .transition()
        .duration(self.settings.animationSpeed)
        .attrTween('points', function (d) {
          this.current = this.current || d;
          const interpolate = d3.interpolate(this.current, d);
          this.current = interpolate(0);
          return function (t) {
            const d2 = interpolate(t);
            const pos = self.outerArc.centroid(d2);
            pos[0] = self.dims.radius * 0.95 * (self.midAngle(d2) < Math.PI ? 1 : -1);
            return [self.outerArc.centroid(d2), self.outerArc.centroid(d2), pos];
          };
        });

      polyline.exit()
        .remove();
    }

    const dots = self.svg.select('.lines').selectAll('circle')
      .data(self.pie(data), self.key);

    dots.enter()
      .append('circle')
      .attr('class', 'circles')
      .attr('r', shouldShow ? 2 : 0)
      .merge(dots)
      .transition()
      .duration(self.settings.animationSpeed)
      .attrTween('transform', function (d) {
        this.current = this.current || d;
        const interpolate = d3.interpolate(this.current, d);
        this.current = interpolate(0);
        return function (t) {
          const d2 = interpolate(t);
          return `translate(${self.outerArc.centroid(d2)} )`;
        };
      });

    dots.exit()
      .remove();
  },

  /**
   * Set the initially selected elements
   * @private
   */
  setInitialSelected() {

  },

  /**
   * Format the value based on settings.
   * @private
   * @param  {object} data The data object.
   * @param  {object} settings The sttings to use
   * @returns {string} the formatted string.
   */
  formatToSettings(data, settings) {
    const d = data.data;

    if (settings.show === 'value') {
      return settings.formatter ? d3.format(settings.formatter)(d.value) : d.value;
    }

    if (settings.show === 'label') {
      return d.name;
    }

    if (settings.show === 'percent') {
      return `${d.percentRound}%`;
    }

    if (typeof settings.show === 'function') {
      return settings.show(data);
    }

    return d.value;
  },

  /**
   * Sets up event handlers for this component and its sub-elements.
   * @returns {object} The Component prototype, useful for chaining.
   * @private
   */
  handleEvents() {
    this.element.on(`updated.${COMPONENT_NAME}`, () => {
      this.updated();
    });

    if (this.settings.redrawOnResize) {
      $('body').on(`resize.${COMPONENT_NAME}`, () => {
        this.handleResize();
      });

      this.element.on(`resize.${COMPONENT_NAME}`, () => {
        this.handleResize();
      });
    }

    return this;
  },

  width: 0,

  /*
   * Get info on the currently selected lines.
   * @returns {object} An object with the matching data and reference to the triggering element.
   */
  getSelected() {
    return charts.selected;
  },

  /*
   * Get info on the currently selected lines.
   */
  setSelected(o, isToggle) {
    const self = this;
    let selector;
    let arcIndex;
    let selected = 0;
    const equals = window.Soho.utils.equals;

    this.svg.selectAll('.slice').each(function (d, i) {
      if (!d || !d.data) {
        return;
      }

      if (selected < 1) {
        if ((typeof o.fieldName !== 'undefined' &&
              typeof o.fieldValue !== 'undefined' &&
                o.fieldValue === d.data[o.fieldName]) ||
            (typeof o.index !== 'undefined' && o.index === i) ||
            (o.data && equals(o.data, self.chartData[i].data)) ||
            (o.elem && $(this).is(o.elem))) {
          selected++;
          selector = d3.select(this);
          arcIndex = i;
        }
      }
    });

    if (selected > 0 && (isToggle || !selector.classed('is-selected'))) {
      selector.on('click').call(selector.node(), selector.datum(), arcIndex);
    }
  },

  /*
   * Get info on the currently selected lines.
   */
  toggleSelected(options) {
    this.setSelected(options, true);
  },

  /*
   * Handles resizing a chart.
   * @private
   * @returns {void}
   */
  handleResize() {
    if (this.width === this.element.width()) {
      return;
    }

    this.width = this.element.width();

    if (!this.element.is(':visible')) {
      return;
    }

    this.updated();
  },

  /**
   * Handle updated settings and values.
   * @param  {object} settings The new settings to use.
   * @returns {object} The api for chaining.
   */
  updated(settings) {
    this.settings = utils.mergeSettings(this.element, settings, this.settings);
    this.element.empty();

    return this
      .teardown()
      .init();
  },

  /**
   * Handle updated settings and values.
   * @param  {array} values A list of values
   * @returns {array} The values rounded to 100
   */
  roundLargestRemainer(values) {
    let sum = 0;
    let count = 0;
    let dVala = 0;
    let dValb = 0;
    const order = [];

    // Round everything down
    for (let i = 0; i < values.length; i++) {
      sum += parseInt(values[i], 10);
      order[i] = i;
    }

    // Getting the difference in sum and 100
    const diff = 100 - sum;

    // Distributing the difference by adding 1 to items in decreasing order of their decimal parts
    order.sort(function (a, b) {
      dVala = values[a] - parseInt(values[a], 10);
      dValb = values[b] - parseInt(values[b], 10);
      return dValb - dVala;
    });

    values.sort(function (a, b) {
      dVala = a - parseInt(a, 10);
      dValb = b - parseInt(b, 10);
      return dValb - dVala;
    });

    for (let j = 0; j < values.length; j++) {
      count = j;
      if (count < diff) {
        values[j] = parseInt(values[j], 10) + 1;
      } else {
        values[j] = parseInt(values[j], 10);
      }
    }

    // Set back the order
    const unsorted = [];
    for (let i = 0; i < values.length; i++) {
      unsorted[order[i]] = values[i];
    }
    return unsorted;
  },

  /**
   * Simple Teardown - remove events & rebuildable markup.
   * @returns {object} The Component prototype, useful for chaining.
   * @private
   */
  teardown() {
    this.element.off(`updated.${COMPONENT_NAME}`);
    $(window).off(`resize.${COMPONENT_NAME}`);
    return this;
  },

  /**
   * Calculate the middle angle.
   * @param  {object} d The d3 data.
   * @returns {boolean} The mid angule
   */
  midAngle(d) {
    return d.startAngle + (d.endAngle - d.startAngle) / 2;
  },

  /**
   * Teardown - Remove added markup and events.
   * @returns {void}
   */
  destroy() {
    this.element.empty().removeClass('pie-chart');
    charts.removeTooltip();
    this.teardown();
    $.removeData(this.element[0], COMPONENT_NAME);
    $.removeData(this.element[0], 'chart');
  }
};

export { Pie, COMPONENT_NAME };
