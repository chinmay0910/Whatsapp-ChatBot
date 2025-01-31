// Mock data - replace with real data from your backend
/*const mockData = {
    scoreDistribution: [
      { score: '0-20', count: 10 },
      { score: '21-40', count: 20 },
      { score: '41-60', count: 35 },
      { score: '61-80', count: 45 },
      { score: '81-100', count: 30 },
    ],
    completionTrend: [
      { date: 'Mon', completions: 12 },
      { date: 'Tue', completions: 19 },
      { date: 'Wed', completions: 15 },
      { date: 'Thu', completions: 25 },
      { date: 'Fri', completions: 23 },
      { date: 'Sat', completions: 18 },
      { date: 'Sun', completions: 16 },
    ],
  };
  
  // Initialize Lucide icons
  lucide.createIcons();
  
  // Initialize Score Distribution Chart
  const scoreChartOptions = {
    series: [{
      name: 'Students',
      data: mockData.scoreDistribution.map(item => item.count)
    }],
    chart: {
      type: 'bar',
      height: 320,
      toolbar: {
        show: false
      }
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: false,
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: mockData.scoreDistribution.map(item => item.score),
      title: {
        text: 'Score Range'
      }
    },
    yaxis: {
      title: {
        text: 'Number of Students'
      }
    },
    colors: ['#3B82F6'],
    tooltip: {
      y: {
        formatter: function (val) {
          return val + " students"
        }
      }
    }
  };
  
  const scoreChart = new ApexCharts(document.querySelector("#scoreChart"), scoreChartOptions);
  scoreChart.render();
  
  // Initialize Completion Trend Chart
  const trendChartOptions = {
    series: [{
      name: 'Completions',
      data: mockData.completionTrend.map(item => item.completions)
    }],
    chart: {
      type: 'line',
      height: 320,
      toolbar: {
        show: false
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    xaxis: {
      categories: mockData.completionTrend.map(item => item.date),
      title: {
        text: 'Day of Week'
      }
    },
    yaxis: {
      title: {
        text: 'Number of Completions'
      }
    },
    colors: ['#3B82F6'],
    markers: {
      size: 5
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val + " completions"
        }
      }
    }
  };
  
  const trendChart = new ApexCharts(document.querySelector("#trendChart"), trendChartOptions);
  trendChart.render();*/
document.addEventListener("DOMContentLoaded", () => {
  fetchStats();
  fetchScoreDistribution();
  fetchCompletionTrend();

  // Initialize Lucide icons
  lucide.createIcons();
});

// 📌 Fetch and Display General Stats
async function fetchStats() {
  try {
    const response = await fetch("/api/quiz/dashboard-stats", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Auth-token": localStorage.getItem('Auth-token')
      },
    });
    const data = await response.json();

    document.querySelector("#totalUsers").textContent = data.totalUsers;
    document.querySelector("#completedQuizzes").textContent = data.completedQuizzes;
    document.querySelector("#verifiedUsers").textContent = data.verifiedUsers;
    document.querySelector("#averageScore").textContent = data.averageScore + "%";
  } catch (error) {
    console.error("Error fetching stats:", error);
  }
}

// 📊 Fetch and Display Score Distribution Chart
async function fetchScoreDistribution() {
  try {
    const response = await fetch("/api/quiz/score-distribution", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Auth-token": localStorage.getItem('Auth-token')
      },
    });
    const data = await response.json();

    const scoreChartOptions = {
      series: [{
        name: 'Students',
        data: data.map(item => item.count)
      }],
      chart: {
        type: 'bar',
        height: 320,
        toolbar: {
          show: false
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          horizontal: false,
        }
      },
      dataLabels: {
        enabled: false
      },
      xaxis: {
        categories: data.map(item => item.score),
        title: {
          text: 'Score Range'
        }
      },
      yaxis: {
        title: {
          text: 'Number of Students'
        }
      },
      colors: ['#3B82F6'],
      tooltip: {
        y: {
          formatter: function (val) {
            return val + " students"
          }
        }
      }
    };

    const scoreChart = new ApexCharts(document.querySelector("#scoreChart"), scoreChartOptions);
    scoreChart.render();
  } catch (error) {
    console.error("Error fetching score distribution:", error);
  }
}

// 📈 Fetch and Display Quiz Completion Trend
async function fetchCompletionTrend() {
  try {
    const response = await fetch("/api/quiz/completion-trend", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Auth-token": localStorage.getItem('Auth-token')
      },
    });
    const data = await response.json();

    const trendChartOptions = {
      series: [{
        name: 'Completions',
        data: data.map(item => item.completions)
      }],
      chart: {
        type: 'line',
        height: 320,
        toolbar: {
          show: false
        }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      xaxis: {
        categories: data.map(item => item.date),
        title: {
          text: 'Day of Week'
        }
      },
      yaxis: {
        title: {
          text: 'Number of Completions'
        }
      },
      colors: ['#3B82F6'],
      markers: {
        size: 5
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return val + " completions"
          }
        }
      }
    };

    const trendChart = new ApexCharts(document.querySelector("#trendChart"), trendChartOptions);
    trendChart.render();
  } catch (error) {
    console.error("Error fetching completion trend:", error);
  }
}
