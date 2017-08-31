var ptI18nRoot = "lib/statcan_sgc/i18n/er",
  rootI18nRoot = "src/i18n/",
  baseMapUrl = "data/canada.json",
  dataUrl = "data/355-0006.json",
  $toCanada = $(".toCanada"),
  ptSelect = document.getElementById("pt_select"),
  canadaSgcId = "01",
  selectedCLass = "selected",
  changePrecision = 1,
  numberFormatter = i18n.getNumberFormatter(changePrecision),
  dateFormatter = i18n.getDateFormatter({
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }),
  chartSettings = {
    datatable: false,
    x: {
      ticks: 60,
      getValue: function(d) {
        return new Date(d.date);
      },
      getText: function(d) {
        return dateFormatter.format(this.x.getValue(d));
      }
    },

    y: {
      getValue: function(d) {
        return d.value / 1000;
      },

      getText: function(d) {
        return numberFormatter.format(this.y.getValue(d));
      }
    },

    z: {
      getKeys: function(d) {
        var keys = Object.keys(d);
        return keys;
      },
      getClass: function(d) {
        return d.key;
      },
      getDataPoints: function(d) {
        return d.values;
      },
      getCurrent: function(d){
        return this.z.getDataPoints.call(this, d).slice(-1).pop();
      },
      getText: function(d) {
        return i18next.t(d.key, {ns: "food_drink"});
      }
    },
    change: {
      getText: function(d) {
        return numberFormatter.format(Math.bankerRound(d.change * 100, changePrecision) );
      }
    },
    showLabels: false
  },
  getProvinceText = function(sgcId) {
    return i18next.t("er_" + sgcId, {ns: "er"});
  },
  denormalizeData = function(data) {
    var pts = Object.keys(data.data),
      rtn = {},
      computeChange = function(object, array, index) {
        if (index === array.length - 1) {
          object.change = getChange(array[index - 1], array[index]);
        }
      },
      totalKey = "total",
      p, province, keys, k, key;

    for(p = 0; p < pts.length;p++) {
      province = pts[p];
      rtn[province] = [];

      keys = Object.keys(data.data[province]);
      if (keys.length !== 1) {
        data.data[province][totalKey] = data.data[province][keys[0]].map(function(value, index) {
          var total = value;
          for (k = 1; k < keys.length; k++) {
            total += data.data[province][keys[k]][index];
          }
          return total;
        });
        keys.unshift(totalKey);
      }
      for (k = 0; k < keys.length; k++) {
        key = keys[k];
        rtn[province].push({
          key: key,
          values: data.data[province][key].map(function(value, index, array) {
            var innerRtn = {
              date: data.keys[index],
              value: value
            };
            computeChange(innerRtn, array, index);
            return innerRtn;
          })
        });
      }
    }

    return rtn;
  },
  getChange = function(value1, value2) {
    return (value2 - value1) / value1;
  },
  clearSelection = function() {
    map.selectAll("." + selectedCLass).classed(selectedCLass, false);
  },
  showData = function(sgcId) {
    var sgcText = getProvinceText(sgcId);
    clearSelection();
    if (sgcId !== canadaSgcId) {
      $toCanada.attr("disabled", null);
      map.selectAll(".canada-map, ." + sgc.province.getCodeFromSGC(sgcId)).classed(selectedCLass, true);
    } else {
      $toCanada.attr("disabled", "true");
    }
    ptSelect.value = sgcId;

    chartSettings.data = foodDrinkData[sgcId];
    chartSettings.altText = i18next.t("chart_alt", {
      ns: "food_drink",
      sgc: sgcText,
      startDate: startDate,
      endDate: endDate
    });
    d3.select(".region").text(sgcText);
    summaryTable(table1, table1Heading, chartSettings, sgcId);
    lineChart(chart, chartSettings);
    showSelected(selected, chartSettings, sgcId);
    drawLegend(chartSettings)
  },
  showSelected = function(obj, sett, sgcId) {
    var current = sett.z.getCurrent.call(sett, sett.data[0]);
    obj.text(getProvinceText(sgcId) + " - " + sett.y.getText.call(sett, current) + " (" + sett.change.getText.call(sett, current) + "%)");
  },
  summaryTable = function(table, heading, sett, sgcId) {
    var header = table.select("thead"),
      body = table.select("tbody.others"),
      bodyTotal = table.select("tbody.total"),
      createRow = function(d) {
        var _this = d3.select(this),
          current = sett.z.getCurrent.call(sett, d),
          sales = getText(current),
          change = sett.change.getText(current);

        _this.append("th").text(sett.z.getText);
        _this.append("td").text(sales);
        _this.append("td").text(change);
      },
      getText = function(d) {
        return (sett.y.getText || sett.y.getValue).call(sett, d);
      },totalRow, rows;

    heading.text(
      getProvinceText(sgcId) + " - " + sett.x.getText.call(sett, sett.z.getCurrent.call(sett, sett.data[0]))
    );

    if (header.empty()) {
      header = table.append("thead").append("tr");

      header.append("td");
      header.append("th")
        .text(sett.y.label);
      header.append("th")
        .text(i18next.t("change", {ns: "food_drink"}));
    }

    if (body.empty()) {
      body = table.append("tbody")
        .attr("class", "others");
      bodyTotal = table.append("tbody")
        .attr("class", "total");
    }

    totalRow = bodyTotal.selectAll("tr")
      .data(sett.data.slice(0,1));

    totalRow
      .enter()
      .append("tr")
        .each(createRow);

    totalRow
      .each(function(d) {
        var current = sett.z.getCurrent.call(sett, d),
          sales = getText(current),
          change = sett.change.getText(current),
          _this = d3.select(this);

        _this.select("td:nth-of-type(1)").text(sales);
        _this.select("td:nth-of-type(2)").text(change);
      });

    rows = body.selectAll("tr")
      .data(sett.data.slice(1));

    rows
      .enter()
      .append("tr")
        .each(createRow);

    rows
      .exit()
        .remove();
  },
  createProvinceSummary = function(table, heading, sett) {
    var header = table.select("thead"),
      body = table.select("tbody"),
      data = sett.z.getKeys.call(sett, foodDrinkData).sort().map(function(key) {
        var total = sett.z.getDataPoints.call(sett, foodDrinkData[key][0]).slice(-1).pop();
        return {
          geo: i18next.t("er_" + key, {ns: "er"}),
          value: total
        };
      }),
      rows;

    heading.text(i18next.t("table1_caption", {
      ns: "food_drink",
      title: i18next.t("title", {ns: "food_drink"}),
      date: endDate
    }));

    if (header.empty()) {
      header = table.append("thead").append("tr");

      header.append("th")
        .text(sett.z.label);
      header.append("th")
        .text(sett.y.label);
      header.append("th")
        .text(i18next.t("change", {ns: "food_drink"}));
    }

    if (body.empty()) {
      body = table.append("tbody");
    }

    rows = body.selectAll("tr")
      .data(data);

    rows
      .enter()
        .append("tr")
        .each(function() {
          var _this = d3.select(this);

          _this.append("th").text(function(d) {
            return d.geo;
          });
          _this.append("td").text(function(d) {
            return sett.y.getText.call(sett, d.value);
          });
          _this.append("td").text(function(d) {
            return sett.change.getText(d.value);
          });
        });
  },
  paintMap = function(sett) {
    var keys = sett.z.getKeys.call(sett, foodDrinkData).sort(),
      interpolate = d3.stcExt.get5PointsInterpolation("#ab8f8f", "#400", d3.rgb(148, 166, 178), "#8fab8f", "#040"),
      min, max, data, d, change, range, domain, temp, percent, percentOverRange, mapLegend;

    keys.shift();

    data = keys.map(function(key) {
      var current = sett.z.getDataPoints.call(sett, foodDrinkData[key][0]).slice(-1).pop();
      min = min === undefined || current.change < min ? current.change : min;
      max = max === undefined || current.change > max ? current.change : max;
      return {
        geo: sgc.province.getCodeFromSGC(key),
        change: current.change
      };
    });

    if (min >= 0 || max <= 0) {
      range = [min, max];
      if (min === 0) {
        domain = [0, 1];
      } else if (min > 0) {
        domain = [0.001, 1];
      } else if (max === 0) {
        domain = [-1, 0];
      } else {
        domain = [-1, -0.001];
      }
    } else {
      temp = Math.abs(min) > max ? Math.abs(min) : max;
      range = [-temp, temp];
      domain = [-1, 1];
    }

    for (d = 0; d < data.length; d++) {
      change = data[d].change;
      if (change !== 0) {

        percent = (change - range[0]) / (range[1]-range[0]);
        percentOverRange = percent * (domain[1] - domain[0]) + domain[0];
        map.select("." + data[d].geo).attr("style", "fill:" + interpolate(percentOverRange));
      }
    }

    mapLegend = d3.select(".food_drink .map")
      .append("svg");

    createLegend(sett, mapLegend, interpolate, range, domain, numberFormatter);
  },
  createLegend = function(sett, legend, interpolate, range, domain, formatter) {
    var length = 9,
      pointSize = 10,
      textSize = 14,
      padding = 5,
      width = sett.width || 600,
      height = pointSize + textSize * 2 + padding * 4,
      innerWidth = length * pointSize + (length - 1) * padding,
      step = (range[1]-range[0]) / (length - 1),
      innerLegend, l, value, percent, percentOverRange, align;

    legend
      .attr("role", "presentation")
      .attr("aria-hidden", "true")
      .attr("viewBox", "0 0 " + width + " " + height);

    if (legend.node().msContentZoomFactor) {
      legend.attr("height", height);
    }

    legend.append("text")
      .attr("x", width / 2)
      .attr("dy", textSize)
      .attr("font-size", textSize)
      .attr("text-anchor", "middle")
      .text(i18next.t("change", {ns: "food_drink"}));

    innerLegend = legend.append("g")
      .attr("transform", "translate(" + (width / 2 - innerWidth / 2) + ", " + (textSize + padding * 2) + ")");

    for(l = 0; l < length; l++) {
      value = range[0] + step * l;
      percent = (value - range[0]) / (range[1]-range[0]);
      percentOverRange = percent * (domain[1] - domain[0]) + domain[0];
      innerLegend.append("rect")
        .attr("x", l * (pointSize + padding))
        .attr("y", 0)
        .attr("height", pointSize)
        .attr("width", pointSize)
        .attr("fill", interpolate(percentOverRange));

      if ([0, Math.floor(length  / 2), length - 1].indexOf(l) !== -1) {
        switch (l / (length - 1)) {
        case 0:
          align = "start";
          break;
        case 1:
          align = "end";
          break;
        default:
          align = "middle";
        }
        innerLegend.append("text")
          .attr("dy", pointSize)
          .attr("y", pointSize + padding)
          .attr("x", l * innerWidth / (length - 1))
          .attr("font-size", textSize)
          .attr("text-anchor", align)
          .text(formatter.format(value * 100));
      }
    }
  },
  toCanada = function() {
    showData(canadaSgcId);
  },
  onMapClick = function(event) {
    var className = event.target.className.baseVal,
      sgcId = sgc.province.getSGCFromCode(className);
    showData(sgcId);
  },
  onGeoSelect = function(e) {
    showData(e.target.value);
  },
  onButtonClick = function() {
    toCanada();
  },
  drawLegend = function(sett) {
    var data = sett.data,
      group = chartLegend.selectAll("g")
        .data(data),
      groupEnter;

    chartLegend
      .attr("role", "img")
      .attr("aria-hidden", "true")
      .attr("viewBox", "0 0 600 " + Math.ceil(
        Object.keys(chartSettings.z.getKeys(data)).length / 2 * 25 + 25
      ));

    groupEnter = group
      .enter()
      .append("g")
        .attr("font-size", "10")
        .attr("transform", function(d, index) {
          var x = (index % 2 === 1 ? 300 : 0),
            y = Math.floor(index / 2) * 25 + 25;

          return "translate(" + x + "," + y + ")";
        });

    groupEnter
      .append("path")
        .attr("d", "m0 0 l40 0")
        .attr("class", chartSettings.z.getClass)
        .classed("dline", true);
    groupEnter
      .append("text")
        .attr("x", 50)
        .text(chartSettings.z.getText);

    group.exit().remove();
  },
  map, selected, chart, table1Heading, table1, chartLegend, foodDrinkData, startDate, endDate;

i18n.load([ptI18nRoot, rootI18nRoot], function() {
  chartSettings.alt = i18next.t("alt", {ns: "line"});
  chartSettings.x.label = i18next.t("x_label", {ns: "food_drink"});
  chartSettings.y.label = i18next.t("y_label", {ns: "food_drink"});
  chartSettings.z.label = i18next.t("z_label", {ns: "food_drink"});

  d3.queue()
    .defer(d3.json, baseMapUrl)
    .defer(d3.json, dataUrl)
    .await(function(error, baseMap, data) {
      var createHeading = function(selection) {
          return selection.append("h2")
            .attr("class", "h4");
        },
        legend, table1Container, table2Container, table2, table2Heading, geoProp;

      foodDrinkData = denormalizeData(data["355-0006"]);

      startDate = chartSettings.x.getText.call(chartSettings, foodDrinkData[canadaSgcId][0].values.slice(0)[0]);
      endDate = chartSettings.x.getText.call(chartSettings, foodDrinkData[canadaSgcId][0].values.slice(-1)[0]);

      for(var p = 0; p < baseMap.objects.PR2016CBF.geometries.length; p++) {
        geoProp = baseMap.objects.PR2016CBF.geometries[p].properties;
        geoProp.PRCODE = sgc.province.getCodeFromSGC(geoProp.PRUID);
      }

      map = d3.select(".food_drink .map")
        .append("svg")
          .attr("id", "food_drink_map")
          .attr("role", "img")
          .attr("aria-label", i18next.t("map_alt", {
            ns: "food_drink",
            title: i18next.t("title", {ns: "food_drink"}),
            change: i18next.t("change", {ns: "food_drink"}),
            date: endDate
          }));

      selected = map.append("text")
        .attr("x", 419)
        .attr("y", 125)
        .attr("font-size", 3.5)
        .attr("aria-hidden", "true");

      chart = d3.select(".food_drink .chart")
          .append("svg")
            .attr("id", "food_drink-chart");

      chartLegend = d3.select(".food_drink .chart")
          .append("svg")
            .attr("id", "food_drink-legend");

      table1Container = d3.select(".food_drink .table1");
      table1Heading = createHeading(table1Container);
      table1 = table1Container
          .append("table")
            .attr("class", "table")
            .attr("id", "food_drink-table1");

      table2Container = d3.select(".food_drink .table2");
      table2Heading = createHeading(table2Container);
      table2 = table2Container
          .append("table")
            .attr("class", "table")
            .attr("id", "food_drink-table2");

      getCanadaMap(map, {
        baseMap: baseMap,
      });

      toCanada();

      paintMap(chartSettings);

      createProvinceSummary(table2, table2Heading, chartSettings);

      $(document).on("change", "#pt_select", onGeoSelect);
      $(map.node()).on("click", "path:not(.selected)", onMapClick);
      $(".food_drink .map").on("click", "button", onButtonClick);
    });
});
