#!/usr/bin/env Rscript
library(ggplot2);
library(plyr);

# get __dirname and load ./_cli.R
args = commandArgs(trailingOnly = F);
dirname = dirname(sub("--file=", "", args[grep("--file", args)]));
source(paste0(dirname, '/_cli.R'), chdir=T);

if (is.null(args.options$title) || !is.null(args.options$plot) && args.options$plot == TRUE) {
  stop("usage: cat file.csv | Rscript scatter.R [variable=value ...]
  --title    variable   title shown on top of the plot (required)
  --plot     filename   save plot to filename
  --log                 use a log-2 scale for xaxis in the plot");
}

plot.filename = args.options$plot;

# parse options
use.log2 = !is.null(args.options$log);

# parse data
dat = read.csv(file('stdin'), strip.white=TRUE);
dat = data.frame(dat);

# List of aggregated variables
aggregate = names(dat);
aggregate = aggregate[
  ! aggregate %in% c('title', 'count', 'duration')
];
# Variables that don't change aren't aggregated
for (aggregate.key in aggregate) {
  if (length(unique(dat[[aggregate.key]])) == 1) {
    aggregate = aggregate[aggregate != aggregate.key];
  }
}

# Print out aggregated variables
for (aggregate.variable in aggregate) {
  cat(sprintf('aggregating variable: %s\n', aggregate.variable));
}
if (length(aggregate) > 0) {
  cat('\n');
}

# Calculate statistics
stats = ddply(dat, c('count', 'title'), function(subdat) {
  duration = subdat$duration;

  # calculate confidence interval of the mean
  ci = NA;
  if (length(duration) > 1) {
    se = sqrt(var(duration)/length(duration));
    ci = se * qt(0.975, length(duration) - 1)
  }

  # calculate mean and 95 % confidence interval
  r = list(
    duration = mean(duration),
    confidence.interval = ci
  );

  return(data.frame(r));
});

print(stats, row.names=F);

if (!is.null(plot.filename)) {
  p = ggplot(stats, aes_string(x='count', y='duration', colour='title'));
  if (use.log2) {
    p = p + scale_x_continuous();
  }
  p = p + geom_errorbar(
    aes(ymin=duration-confidence.interval, ymax=duration+confidence.interval),
    width=1, na.rm=TRUE, alpha=.5
  );
  p = p + geom_point();
  p = p + geom_line();
  p = p + ylab("duration of operations (lower is better)");
  p = p + ggtitle(args.options$title);
  ggsave(plot.filename, p);
}
