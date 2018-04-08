frappe.provide("erpnext.setup");

frappe.pages['setup-wizard'].on_page_load = function(wrapper) {
	if(frappe.sys_defaults.company) {
		frappe.set_route("desk");
		return;
	}
};

frappe.setup.on("before_load", function () {
	erpnext.setup.slides_settings.map(frappe.setup.add_slide);
});

erpnext.setup.slides_settings = [
	{
		// Domain
		name: 'domain',
		title: __('Select your Domains'),
		fields: [
			{
				fieldname: 'domains',
				label: __('Domains'),
				fieldtype: 'MultiCheck',
				options: [
					{ "label": __("Distribution"), "value": "Distribution" },
					{ "label": __("Education"), "value": "Education" },
					{ "label": __("Manufacturing"), "value": "Manufacturing" },
					{ "label": __("Retail"), "value": "Retail" },
					{ "label": __("Services"), "value": "Services" },
					{ "label": __("Agriculture (beta)"), "value": "Agriculture" },
					{ "label": __("Healthcare (beta)"), "value": "Healthcare" },
					{ "label": __("Non Profit (beta)"), "value": "Non Profit" }
				], reqd: 1
			},
		],
		// help: __('Select the nature of your business.'),
		validate: function () {
			if (this.values.domains.length === 0) {
				frappe.msgprint(__("Please select at least one domain."));
				return false;
			}
			frappe.setup.domains = this.values.domains;
			return true;
		},
	},

	{
		// Brand
		name: 'brand',
		icon: "fa fa-bookmark",
		title: __("The Brand"),
		// help: __('Upload your letter head and logo. (you can edit them later).'),
		fields: [
			{
				fieldtype: "Attach Image", fieldname: "attach_logo",
				label: __("Attach Logo"),
				description: __("100px by 100px"),
				is_private: 0,
				align: 'center'
			},
			{
				fieldname: 'company_name',
				label: frappe.setup.domains.includes('Education') ?
					__('Institute Name') : __('Company Name'),
				fieldtype: 'Data',
				reqd: 1
			},
			{
				fieldname: 'company_abbr',
				label: frappe.setup.domains.includes('Education') ?
					__('Institute Abbreviation') : __('Company Abbreviation'),
				fieldtype: 'Data'
			}
		],
		onload: function(slide) {
			this.bind_events(slide);
		},
		bind_events: function (slide) {
			slide.get_input("company_name").on("change", function () {
				var parts = slide.get_input("company_name").val().split(" ");
				var abbr = $.map(parts, function (p) { return p ? p.substr(0, 1) : null }).join("");
				slide.get_field("company_abbr").set_value(abbr.slice(0, 5).toUpperCase());
			}).val(frappe.boot.sysdefaults.company_name || "").trigger("change");

			slide.get_input("company_abbr").on("change", function () {
				if (slide.get_input("company_abbr").val().length > 5) {
					frappe.msgprint(__("Company Abbreviation cannot have more than 5 characters"));
					slide.get_field("company_abbr").set_value("");
				}
			});
		},
		validate: function() {
			if ((this.values.company_name || "").toLowerCase() == "company") {
				frappe.msgprint(__("Company Name cannot be Company"));
				return false;
			}
			if (!this.values.company_abbr) {
				return false;
			}
			return true;
		}
	},
	{
		// Organisation
		name: 'organisation',
		title: __("Your Organization"),
		icon: "fa fa-building",
		// help: frappe.setup.domains.includes('Education') ?
		// 	__('The name of the institute for which you are setting up this system.') :
		// 	__('The name of your company for which you are setting up this system.')),
		fields: [
			{
				fieldname: 'company_tagline',
				label: __('What does it do?'),
				fieldtype: 'Data',
				placeholder: frappe.setup.domains.includes('Education') ?
					__('e.g. "Primary School" or "University"') :
					__('e.g. "Build tools for builders"'),
				reqd: 1
			},
			{ fieldname: 'bank_account', label: __('Bank Name'), fieldtype: 'Data', reqd: 1 },
			{
				fieldname: 'chart_of_accounts', label: __('Chart of Accounts'),
				options: "", fieldtype: 'Select'
			},

			{ fieldtype: "Section Break", label: __('Financial Year') },
			{ fieldname: 'fy_start_date', label: __('Start Date'), fieldtype: 'Date', reqd: 1 },
			{ fieldtype: "Column Break" },
			{ fieldname: 'fy_end_date', label: __('End Date'), fieldtype: 'Date', reqd: 1 },
		],

		onload: function (slide) {
			this.load_chart_of_accounts(slide);
			this.bind_events(slide);
			this.set_fy_dates(slide);
		},

		validate: function () {
			let me = this;
			let exist;

			// validate fiscal year start and end dates
			if (this.values.fy_start_date == 'Invalid date' || this.values.fy_end_date == 'Invalid date') {
				frappe.msgprint(__("Please enter valid Financial Year Start and End Dates"));
				return false;
			}

			// Validate bank name
			if(me.values.bank_account){
				frappe.call({
					async: false,
					method: "erpnext.accounts.doctype.account.chart_of_accounts.chart_of_accounts.validate_bank_account",
					args: {
						"coa": me.values.chart_of_accounts,
						"bank_account": me.values.bank_account
					},
					callback: function (r) {
						if(r.message){
							exist = r.message;
							me.get_field("bank_account").set_value("");
							frappe.msgprint(__(`Account ${me.values.bank_account} already exists, enter a different name for your bank account`));
						}
					}
				});
				return !exist; // Return False if exist = true
			}

			return true;
		},

		set_fy_dates: function (slide) {
			var country = frappe.wizard.values.country;

			if (country) {
				var fy = erpnext.setup.fiscal_years[country];
				var current_year = moment(new Date()).year();
				var next_year = current_year + 1;
				if (!fy) {
					fy = ["01-01", "12-31"];
					next_year = current_year;
				}

				var year_start_date = current_year + "-" + fy[0];
				if (year_start_date > frappe.datetime.get_today()) {
					next_year = current_year;
					current_year -= 1;
				}
				slide.get_field("fy_start_date").set_value(current_year + '-' + fy[0]);
				slide.get_field("fy_end_date").set_value(next_year + '-' + fy[1]);
			}
		},


		load_chart_of_accounts: function (slide) {
			var country = frappe.wizard.values.country;

			if (country) {
				frappe.call({
					method: "erpnext.accounts.doctype.account.chart_of_accounts.chart_of_accounts.get_charts_for_country",
					args: { "country": country },
					callback: function (r) {
						if (r.message) {
							slide.get_input("chart_of_accounts").empty()
								.add_options(r.message);

							if (r.message.length === 1) {
								var field = slide.get_field("chart_of_accounts");
								field.set_value(r.message[0]);
								field.df.hidden = 1;
								field.refresh();
							}
						}
					}
				})
			}
		},

		bind_events: function (slide) {
			slide.get_input("fy_start_date").on("change", function () {
				var start_date = slide.form.fields_dict.fy_start_date.get_value();
				var year_end_date =
					frappe.datetime.add_days(frappe.datetime.add_months(start_date, 12), -1);
				slide.form.fields_dict.fy_end_date.set_value(year_end_date);
			});
		}
	}
];

// Source: https://en.wikipedia.org/wiki/Fiscal_year
// default 1st Jan - 31st Dec

erpnext.setup.fiscal_years = {
	"Afghanistan": ["12-21", "12-20"],
	"Australia": ["07-01", "06-30"],
	"Bangladesh": ["07-01", "06-30"],
	"Canada": ["04-01", "03-31"],
	"Costa Rica": ["10-01", "09-30"],
	"Egypt": ["07-01", "06-30"],
	"Hong Kong": ["04-01", "03-31"],
	"India": ["04-01", "03-31"],
	"Iran": ["06-23", "06-22"],
	"Italy": ["07-01", "06-30"],
	"Myanmar": ["04-01", "03-31"],
	"New Zealand": ["04-01", "03-31"],
	"Pakistan": ["07-01", "06-30"],
	"Singapore": ["04-01", "03-31"],
	"South Africa": ["03-01", "02-28"],
	"Thailand": ["10-01", "09-30"],
	"United Kingdom": ["04-01", "03-31"],
};
