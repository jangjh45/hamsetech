package com.hamsetech.hamsetech.todo;

import java.time.LocalDate;

public record TodoOverdueSummary(long count, LocalDate earliestDate) {}
